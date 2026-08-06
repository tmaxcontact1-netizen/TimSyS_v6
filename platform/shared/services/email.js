'use strict';

var transporter = null;

function initEmail() {
  if (transporter) return transporter;

  var smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) return null;

  var nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

function sendPasswordReset(userEmail, resetToken) {
  return new Promise(function(resolve, reject) {
    var t = initEmail();
    if (!t) {
      reject(new Error('SMTP not configured'));
      return;
    }

    var frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    var resetUrl = frontendUrl + '/reset-password?token=' + resetToken;

    var mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@timsys.local',
      to: userEmail,
      subject: 'Password Reset Request — TimSyS',
      html: '<h2>Password Reset Request</h2>' +
            '<p>You requested a password reset for your TimSyS account.</p>' +
            '<p>Click the link below to set a new password:</p>' +
            '<p><a href="' + resetUrl + '">' + resetUrl + '</a></p>' +
            '<p>This link expires in 1 hour.</p>' +
            '<p>If you didn\'t request this, ignore this email.</p>',
    };

    t.sendMail(mailOptions, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  initEmail: initEmail,
  sendPasswordReset: sendPasswordReset,
};