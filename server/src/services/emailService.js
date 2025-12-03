const nodemailer = require('nodemailer');

/**
 * Email notification service for subscription events
 * Configure your email provider in .env:
 * EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send trial ending notification (3 days before expiry)
 */
const sendTrialEndingEmail = async (userEmail, userName, daysRemaining) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"RecordIQ" <noreply@recordiq.com>',
    to: userEmail,
    subject: `⏰ Your RecordIQ trial ends in ${daysRemaining} days`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .cta-button { display: inline-block; background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .feature-item { margin: 10px 0; padding-left: 25px; position: relative; }
          .feature-item:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Your Trial is Ending Soon</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            
            <div class="warning-box">
              <strong>Your RecordIQ free trial ends in ${daysRemaining} days.</strong>
            </div>
            
            <p>You've been enjoying RecordIQ's powerful invoicing and business management tools. Don't let your momentum stop!</p>
            
            <div class="features">
              <h3>Continue with a paid plan to keep:</h3>
              <div class="feature-item">Creating and sending professional invoices</div>
              <div class="feature-item">Managing your customer database</div>
              <div class="feature-item">Scanning receipts and documents with OCR</div>
              <div class="feature-item">Tracking business records and inventory</div>
              <div class="feature-item">Accepting M-Pesa and card payments</div>
            </div>
            
            <p><strong>Affordable plans starting at just $3/month!</strong></p>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://recordiq.com'}/subscription" class="cta-button">
                View Plans & Upgrade
              </a>
            </center>
            
            <p>Have questions? Just reply to this email and we'll help you choose the right plan.</p>
            
            <p>Best regards,<br>The RecordIQ Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${userName || 'there'},

Your RecordIQ free trial ends in ${daysRemaining} days.

Don't lose access to:
• Professional invoicing
• Customer management
• OCR document scanning
• Business records tracking
• M-Pesa & card payments

Upgrade now from just $3/month: ${process.env.FRONTEND_URL || 'https://recordiq.com'}/subscription

Questions? Reply to this email.

Best regards,
The RecordIQ Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Trial ending email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending trial ending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send trial expired notification
 */
const sendTrialExpiredEmail = async (userEmail, userName) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"RecordIQ" <noreply@recordiq.com>',
    to: userEmail,
    subject: '🔒 Your RecordIQ trial has expired',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
          .cta-button { display: inline-block; background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .plan-box { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #e5e7eb; }
          .plan-price { font-size: 24px; font-weight: bold; color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Your Trial Has Expired</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            
            <div class="alert-box">
              <strong>Your RecordIQ free trial has ended.</strong><br>
              Upgrade now to regain access to your account and data.
            </div>
            
            <p>Your business data is safe and waiting for you. Simply choose a plan to continue:</p>
            
            <div class="plan-box">
              <strong>Basic Plan</strong><br>
              <span class="plan-price">$3/month</span><br>
              Perfect for freelancers and solo entrepreneurs
            </div>
            
            <div class="plan-box">
              <strong>Pro Plan</strong><br>
              <span class="plan-price">$10/month</span><br>
              Ideal for growing small businesses
            </div>
            
            <div class="plan-box">
              <strong>Enterprise Plan</strong><br>
              <span class="plan-price">$150/month</span><br>
              Unlimited everything for established businesses
            </div>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://recordiq.com'}/subscription" class="cta-button">
                Reactivate Your Account
              </a>
            </center>
            
            <p>Need help choosing? Reply to this email and we'll assist you.</p>
            
            <p>Best regards,<br>The RecordIQ Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Trial expired email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending trial expired email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send payment failed notification
 */
const sendPaymentFailedEmail = async (userEmail, userName, amount, tier) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"RecordIQ" <noreply@recordiq.com>',
    to: userEmail,
    subject: '⚠️ Payment failed - Update your subscription',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .cta-button { display: inline-block; background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Payment Failed</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            
            <p>We couldn't process your payment of <strong>$${amount}</strong> for your ${tier} subscription.</p>
            
            <p>Please update your payment method to continue enjoying RecordIQ without interruption.</p>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://recordiq.com'}/subscription" class="cta-button">
                Update Payment Method
              </a>
            </center>
            
            <p>Best regards,<br>The RecordIQ Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Payment failed email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending payment failed email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send successful upgrade notification
 */
const sendUpgradeSuccessEmail = async (userEmail, userName, tier, amount) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"RecordIQ" <noreply@recordiq.com>',
    to: userEmail,
    subject: '🎉 Welcome to RecordIQ ' + tier.charAt(0).toUpperCase() + tier.slice(1),
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Upgrade Successful!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName || 'there'},</p>
            
            <div class="success-box">
              <strong>You've successfully upgraded to the ${tier.toUpperCase()} plan!</strong><br>
              Payment of $${amount} processed.
            </div>
            
            <p>You now have access to all the features of your new plan. Start growing your business with RecordIQ!</p>
            
            <p>Best regards,<br>The RecordIQ Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Upgrade success email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending upgrade email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendTrialEndingEmail,
  sendTrialExpiredEmail,
  sendPaymentFailedEmail,
  sendUpgradeSuccessEmail,
};
