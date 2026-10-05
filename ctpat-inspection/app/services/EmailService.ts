import * as MailComposer from "expo-mail-composer";
import { Alert, Platform } from "react-native";

class EmailService {
  /**
   * Sends an inspection report via email with PDF attachment
   * Uses native mail composer on mobile, web fallback
   * @param pdfFilePath - The path to the PDF file
   * @param recipientEmail - The email address to send to
   * @param formLabel - Form type (e.g. "Flatbed 6-Point") for the subject line
   * @param reference - Seal, truck or container number to identify the inspection
   * @param inspectorName - Inspector name for the email body
   */
  async sendInspectionReport(
    pdfFilePath: string,
    recipientEmail: string,
    formLabel: string,
    reference: string,
    inspectorName: string
  ): Promise<void> {
    try {
      // Check if mail composer is available
      const isAvailable = await MailComposer.isAvailableAsync();
      
      if (!isAvailable) {
        // On web or if mail is not available, show alert with instructions
        if (Platform.OS === 'web') {
          Alert.alert(
            'Email Not Available',
            'Please copy the file link and send via email manually. The PDF has been generated and is ready to download.'
          );
          return;
        }
        throw new Error('Mail composer is not available on this device');
      }

      const subject = `CTPAT Inspection Report - ${formLabel} - ${reference}`;
      const body = `Hello,

Please find attached the CTPAT inspection report for ${formLabel} (${reference}).

This inspection was completed by: ${inspectorName}
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

All required inspection points have been documented and verified.

Best regards,
CTPAT Inspection and Signoff App`;

      // Send email using native mail composer
      const result = await MailComposer.composeAsync({
        recipients: [recipientEmail],
        subject,
        body,
        attachments: [pdfFilePath],
      });

      console.log('Email result:', result.status);
      
      if (result.status === MailComposer.SendStatus.Sent) {
        Alert.alert('Success', 'Email sent successfully!');
      } else if (result.status === MailComposer.SendStatus.Saved) {
        Alert.alert('Success', 'Email saved as draft');
      } else {
        Alert.alert('Info', 'Email composer closed');
      }
    } catch (error) {
      console.error("Error sending inspection report:", error);
      Alert.alert(
        'Error',
        'Failed to open email composer. Please check your email configuration.'
      );
      throw error;
    }
  }
}

export default new EmailService();
