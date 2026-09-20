import logging
import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status, Response, Body
from backend.services.pdf_report_service import generate_audit_pdf
from backend.services.auth_service import get_optional_current_user
from backend.models.database import User

logger = logging.getLogger("VoiceDetector.ReportRoutes")

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.post("/audit-pdf")
async def export_audit_pdf(
    report_data: Dict[str, Any] = Body(...),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Accepts forensic analysis result data and generates a downloadable PDF audit report.
    Returns binary application/pdf with appropriate Content-Disposition header.
    """
    if not report_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No analysis audit data provided for PDF generation."
        )

    try:
        report_id = report_data.get("id") or report_data.get("reportId") or f"VS-{int(datetime.datetime.now().timestamp())}"
        # Sanitize report ID for safe filename
        safe_id = "".join(c for c in str(report_id) if c.isalnum() or c in "-_")
        filename = f"CallShadow_Audit_Report_{safe_id}.pdf"

        # If user is logged in, attach their name/organization if missing
        if current_user and not report_data.get("generatedBy"):
            report_data["generatedBy"] = current_user.full_name

        pdf_bytes = generate_audit_pdf(report_data)
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Generated PDF document was empty."
            )

        logger.info(f"Generated PDF audit report '{filename}' ({len(pdf_bytes)} bytes)")

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "Cache-Control": "no-cache"
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating audit PDF: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audit report PDF: {str(exc)}"
        )
