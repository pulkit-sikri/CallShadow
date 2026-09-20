import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export const permissionService = {
  async getMicrophonePermission(): Promise<PermissionStatus> {
    try {
      const response = await getRecordingPermissionsAsync();
      return {
        granted: response.granted,
        canAskAgain: response.canAskAgain,
        status: response.status,
      };
    } catch (error) {
      console.warn('Error checking microphone permission:', error);
      return { granted: false, canAskAgain: true, status: 'undetermined' };
    }
  },

  async requestMicrophonePermission(): Promise<PermissionStatus> {
    try {
      const response = await requestRecordingPermissionsAsync();
      return {
        granted: response.granted,
        canAskAgain: response.canAskAgain,
        status: response.status,
      };
    } catch (error) {
      console.warn('Error requesting microphone permission:', error);
      return { granted: false, canAskAgain: false, status: 'denied' };
    }
  },
};
