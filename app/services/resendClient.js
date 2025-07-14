app/services/resendClient.js

```javascript
import { Resend } from 'resend';

class ResendClient {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'glamraisers@gmail.com';
    this.defaultTemplate = 'default';
  }

  async sendEmail({
    to,
    subject,
    html,
    text,
    template,
    templateData = {},
    attachments = [],
    replyTo,
    cc,
    bcc,
    tags = [],
    headers = {}
  }) {
    try {
      if (!to || !subject) {
        throw new Error('Missing required fields: to, subject');
      }

      const emailData = {
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(html && { html }),
        ...(text && { text }),
        ...(replyTo && { reply_to: replyTo }),
        ...(cc && { cc: Array.isArray(cc) ? cc : [cc] }),
        ...(bcc && { bcc: Array.isArray(bcc) ? bcc : [bcc] }),
        ...(attachments.length > 0 && { attachments }),
        ...(tags.length > 0 && { tags }),
        ...(Object.keys(headers).length > 0 && { headers })
      };

      const response = await this.resend.emails.send(emailData);
      
      return {
        success: true,
        data: response,
        messageId: response.id
      };
    } catch (error) {
      console.error('Resend email error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
        code: error.code || 'SEND_ERROR'
      };
    }
  }

  async sendWelcomeEmail(userEmail, userName, verificationToken) {
    const subject = 'Welcome to VopeX Sales - Verify Your Account';
    const html = this.generateWelcomeEmailHTML(userName, verificationToken);
    const text = this.generateWelcomeEmailText(userName, verificationToken);

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text,
      tags: ['welcome', 'verification']
    });
  }

  async sendPasswordResetEmail(userEmail, userName, resetToken) {
    const subject = 'Reset Your VopeX Sales Password';
    const html = this.generatePasswordResetHTML(userName, resetToken);
    const text = this.generatePasswordResetText(userName, resetToken);

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text,
      tags: ['password-reset']
    });
  }

  async sendLeadNotificationEmail(userEmail, userName, leadData) {
    const subject = `New Lead Alert: ${leadData.name}`;
    const html = this.generateLeadNotificationHTML(userName, leadData);
    const text = this.generateLeadNotificationText(userName, leadData);

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text,
      tags: ['lead-notification', 'alert']
    });
  }

  async sendSalesReportEmail(userEmail, userName, reportData) {
    const subject = `Your Sales Report - ${reportData.period}`;
    const html = this.generateSalesReportHTML(userName, reportData);
    const text = this.generateSalesReportText(userName, reportData);

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text,
      tags: ['sales-report', 'analytics']
    });
  }

  async sendBulkEmail(recipients, subject, html, text, options = {}) {
    const results = [];
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(recipient => 
        this.sendEmail({
          to: recipient.email,
          subject: this.personalizeSubject(subject, recipient),
          html: this.personalizeHTML(html, recipient),
          text: this.personalizeText(text, recipient),
          tags: ['bulk-email', ...(options.tags || [])],
          ...options
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(1000);
      }
    }

    return results;
  }

  async validateEmail(email) {
    try {
      const response = await fetch(`https://api.resend.com/emails/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        valid: data.valid,
        reason: data.reason,
        suggestions: data.suggestions || []
      };
    } catch (error) {
      console.error('Email validation error:', error);
      return {
        valid: false,
        reason: 'validation_failed',
        suggestions: []
      };
    }
  }

  generateWelcomeEmailHTML(userName, verificationToken) {
    const verificationUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to VopeX Sales</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to VopeX Sales!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Thank you for joining VopeX Sales! We're excited to help you streamline your sales process with AI-powered tools.</p>
            <p>To get started, please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This verification link will expire in 24 hours.</p>
            <p>Best regards,<br>The VopeX Sales Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Glam Raisers. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateWelcomeEmailText(userName, verificationToken) {
    const verificationUrl = `${process.env.APP_URL}/verify?token=${verificationToken}`;
    
    return `
      Welcome to VopeX Sales!

      Hello ${userName},

      Thank you for joining VopeX Sales! We're excited to help you streamline your sales process with AI-powered tools.

      To get started, please verify your email address by visiting:
      ${verificationUrl}

      This verification link will expire in 24 hours.

      Best regards,
      The Glam Raisers Team

      © 2025 Glam Raisers. All rights reserved.
    `;
  }

  generatePasswordResetHTML(userName, resetToken) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We received a request to reset your password for your VopeX Sales account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <div class="warning">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.
            </div>
            <p>Best regards,<br>The VopeX Sales Team</p>
          </div>
          <div class="footer">
            <p>© 2024 VopeX Sales. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  generatePasswordResetText(userName, resetToken) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    return `
      Password Reset Request

      Hello ${userName},

      We received a request to reset your password for your VopeX Sales account.

      To reset your password, visit:
      ${resetUrl}

      IMPORTANT: This link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.

      Best regards,
      The VopeX Sales Team

      © 2025 Glam Raisers. All rights reserved.
    `;
  }

  generateLeadNotificationHTML(userName, leadData) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Lead Alert</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
            .lead-info { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .lead-info h3 { margin-top: 0; color: #2ecc71; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .priority { background: #e74c3c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎯 New Lead Alert!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>You have a new lead in your VopeX Sales pipeline!</p>
            <div class="lead-info">
              <h3>Lead Information</h3>
              <p><strong>Name:</strong> ${leadData.name}</p>
              <p><strong>Email:</strong> ${leadData.email}</p>
              <p><strong>Phone:</strong> ${leadData.phone || 'Not provided'}</p>
              <p><strong>Company:</strong> ${leadData.company || 'Not provided'}</p>
              <p><strong>Source:</strong> ${leadData.source}</p>
              <p><strong>Score:</strong> ${leadData.score}/100 ${leadData.score >= 70 ? '<span class="priority">HIGH PRIORITY</span>' : ''}</p>
              <p><strong>Message:</strong> ${leadData.message || 'No message provided'}</p>
            </div>
            <p>Don't forget to follow up quickly to maximize your conversion chances!</p>
            <p>Best regards,<br>The VopeX Sales Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Glam Raisers. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateLeadNotificationText(userName, leadData) {
    return `
      New Lead Alert!

      Hello ${userName},

      You have a new lead in your VopeX Sales pipeline!

      Lead Information:
      - Name: ${leadData.name}
      - Email: ${leadData.email}
      - Phone: ${leadData.phone || 'Not provided'}
      - Company: ${leadData.company || 'Not provided'}
      - Source: ${leadData.source}
      - Score: ${leadData.score}/100 ${leadData.score >= 70 ? '(HIGH PRIORITY)' : ''}
      - Message: ${leadData.message || 'No message provided'}

      Don't forget to follow up quickly to maximize your conversion chances!

      Best regards,
      The Glam Raisers Team

      © 2025 Glam Raisers. All rights reserved.
    `;
  }

  generateSalesReportHTML(userName, reportData) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sales Report</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
            .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
            .stat-number { font-size: 2em; font-weight: bold; color: #3498db; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Sales Report</h1>
            <p>${reportData.period}</p>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>Here's your sales performance summary:</p>
            <div class="stats">
              <div class="stat-card">
                <div class="stat-number">${reportData.totalLeads}</div>
                <div>Total Leads</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${reportData.conversions}</div>
                <div>Conversions</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${reportData.conversionRate}%</div>
                <div>Conversion Rate</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">$${reportData.revenue}</div>
                <div>Revenue</div>
              </div>
            </div>
            <h3>Top Performance Metrics:</h3>
            <ul>
              <li><strong>Best performing source:</strong> ${reportData.topSource}</li>
              <li><strong>Average deal size:</strong> $${reportData.avgDealSize}</li>
              <li><strong>Average response time:</strong> ${reportData.avgResponseTime}</li>
            </ul>
            <p>Keep up the great work!</p>
            <p>Best regards,<br>The VopeX Sales Team</p>
          </div>
          <div class="footer">
            <p>© 2024 VopeX Sales. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  generateSalesReportText(userName, reportData) {
    return `
      Sales Report - ${reportData.period}

      Hello ${userName},

      Here's your sales performance summary:

      Key Metrics:
      - Total Leads: ${reportData.totalLeads}
      - Conversions: ${reportData.conversions}
      - Conversion Rate: ${reportData.conversionRate}%
      - Revenue: $${reportData.revenue}

      Top Performance Metrics:
      - Best performing source: ${reportData.topSource}
      - Average deal size: $${reportData.avgDealSize}
      - Average response time: ${reportData.avgResponseTime}

      Keep up the great work!

      Best regards,
      The Glam Raisers Team

      © 2025 Glam Raisers. All rights reserved.
    `;
  }

  personalizeSubject(subject, recipient) {
    return subject.replace(/\{\{name\}\}/g, recipient.name || 'there');
  }

  personalizeHTML(html, recipient) {
    return html
      .replace(/\{\{name\}\}/g, recipient.name || 'there')
      .replace(/\{\{email\}\}/g, recipient.email)
      .replace(/\{\{company\}\}/g, recipient.company || 'your company');
  }

  personalizeText(text, recipient) {
    return text
      .replace(/\{\{name\}\}/g, recipient.name || 'there')
      .replace(/\{\{email\}\}/g, recipient.email)
      .replace(/\{\{company\}\}/g, recipient.company || 'your company');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getEmailStatus(messageId) {
    try {
      const response = await fetch(`https://api.resend.com/emails/${messageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get email status: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Get email status error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createContact(email, firstName, lastName, audienceId) {
    try {
      const response = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          audience_id: audienceId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create contact: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Create contact error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async removeContact(contactId) {
    try {
      const response = await fetch(`https://api.resend.com/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to remove contact: ${response.statusText}`);
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('Remove contact error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const resendClient = new ResendClient();
export default resendClient;
```