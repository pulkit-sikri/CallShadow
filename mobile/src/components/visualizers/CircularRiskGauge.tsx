import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';

interface CircularRiskGaugeProps {
  riskPercentage: number; // 0 - 100
  size?: number;
  strokeWidth?: number;
  showVerdict?: boolean;
  verdictText?: string;
  style?: ViewStyle;
  sublabel?: string;
}

export const CircularRiskGauge: React.FC<CircularRiskGaugeProps> = ({
  riskPercentage,
  size = 200,
  strokeWidth = 14,
  showVerdict = true,
  verdictText,
  style,
  sublabel = 'AI SYNTHETIC RISK',
}) => {
  const clampedRisk = Math.min(100, Math.max(0, Math.round(riskPercentage)));

  const center = size / 2;
  const radius = center - strokeWidth - 4;
  const circumference = 2 * Math.PI * radius;

  // 240-degree open arc configuration
  const arcDegrees = 240;
  const startAngle = 150; // starts at bottom left

  const getRiskColor = (risk: number) => {
    if (risk < 30) return colors.riskLow;
    if (risk < 50) return colors.riskMedium;
    return colors.riskHigh;
  };

  const getRiskBg = (risk: number) => {
    if (risk < 30) return colors.riskLowLight;
    if (risk < 50) return colors.riskMediumLight;
    return colors.riskHighLight;
  };

  const activeColor = getRiskColor(clampedRisk);
  const activeBg = getRiskBg(clampedRisk);

  const getAutoVerdict = (risk: number) => {
    if (risk < 30) return 'VERIFIED AUTHENTIC';
    if (risk < 50) return 'SUSPICIOUS ANOMALY';
    return 'SYNTHETIC RISK DETECTED';
  };

  const displayVerdict = verdictText || getAutoVerdict(clampedRisk);

  // Helper to calculate arc path in SVG
  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, startAng: number, endAng: number) => {
    const start = polarToCartesian(x, y, r, endAng);
    const end = polarToCartesian(x, y, r, startAng);
    const largeArcFlag = endAng - startAng <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const bgArcPath = describeArc(center, center, radius, startAngle, startAngle + arcDegrees);
  const currentAngle = startAngle + (clampedRisk / 100) * arcDegrees;
  const fgArcPath = clampedRisk > 0 ? describeArc(center, center, radius, startAngle, currentAngle) : '';

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* SVG Arc Gauge */}
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Track */}
        <Path
          d={bgArcPath}
          stroke="#EAE4D9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {/* Active Value Arc */}
        {fgArcPath ? (
          <Path
            d={fgArcPath}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>

      {/* Central Content */}
      <View style={styles.centerContent}>
        <Text style={[styles.percentageText, { fontSize: size * 0.22 }]}>
          {clampedRisk}
          <Text style={[styles.percentSymbol, { fontSize: size * 0.12, color: activeColor }]}>%</Text>
        </Text>

        <Text style={[styles.sublabel, { fontSize: Math.max(9, size * 0.052) }]}>
          {sublabel}
        </Text>

        {showVerdict && (
          <View
            style={[
              styles.verdictPill,
              {
                backgroundColor: activeBg,
                borderColor: activeColor,
              },
            ]}
          >
            <Text style={[styles.verdictText, { color: activeColor, fontSize: Math.max(9, size * 0.048) }]}>
              {displayVerdict}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  percentageText: {
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  percentSymbol: {
    fontWeight: '800',
  },
  sublabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  verdictPill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictText: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
