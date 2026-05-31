/**
 * SkillHeed NEP Tracking Script
 * Embed this on your website to track school interest and associations
 * 
 * Usage:
 * <script src="https://your-domain.com/scripts/skillheed-tracker.js" data-api-key="your_public_key"></script>
 */

(function() {
  'use strict';

  // Configuration
  const script = document.currentScript;
  const apiKey = script.getAttribute('data-api-key');
  const apiUrl = script.getAttribute('data-api-url') || window.location.origin;
  
  if (!apiKey) {
    console.error('[SkillHeed NEP] API key is required. Add data-api-key attribute to script tag.');
    return;
  }

  // Cookie utilities
  const Cookies = {
    set: function(name, value, days) {
      const expires = new Date();
      expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/';
    },
    get: function(name) {
      const nameEQ = name + '=';
      const ca = document.cookie.split(';');
      for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    },
    delete: function(name) {
      this.set(name, '', -1);
    }
  };

  // Get association code from URL parameter
  function getAssociationCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('partner_id') || urlParams.get('ref') || urlParams.get('association');
  }

  // Track association click
  function trackAssociation(associationCode) {
    fetch(apiUrl + '/api/track/referral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        referralCode: associationCode,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('[SkillHeed NEP] Association tracked successfully');
        // Store association code in cookie (30 days default)
        Cookies.set('skillheed_partner', associationCode, 30);
      } else {
        console.error('[SkillHeed NEP] Failed to track association:', data.error);
      }
    })
    .catch(error => {
      console.error('[SkillHeed NEP] Error tracking association:', error);
    });
  }

  // Track school onboarding
  function trackSchoolOnboarding(options) {
    const associationCode = Cookies.get('skillheed_partner');
    
    if (!associationCode) {
      console.warn('[SkillHeed NEP] No association code found in cookies');
      return Promise.resolve({ success: false, error: 'No association code' });
    }

    return fetch(apiUrl + '/api/track/conversion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        referralCode: associationCode,
        customerEmail: options.email,
        customerName: options.name,
        amount: options.amount || 0,
        currency: options.currency || 'INR',
        orderId: options.orderId,
        metadata: options.metadata || {},
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('[SkillHeed NEP] School onboarding tracked successfully');
        // Clear association cookie after onboarding
        Cookies.delete('skillheed_partner');
      } else {
        console.error('[SkillHeed NEP] Failed to track school onboarding:', data.error);
      }
      return data;
    })
    .catch(error => {
      console.error('[SkillHeed NEP] Error tracking school onboarding:', error);
      return { success: false, error: error.message };
    });
  }

  // Initialize tracking
  function init() {
    // Check for association code in URL
    const partnerCode = getAssociationCodeFromURL();
    
    if (partnerCode) {
      // Validate association code format before tracking
      if (/^[A-Za-z0-9\-]{3,32}$/.test(partnerCode)) {
        trackAssociation(partnerCode);
      }
    } else {
      // Check if we have a stored association code
      const storedPartner = Cookies.get('skillheed_partner');
      if (storedPartner) {
        // Stored association code found
      }
    }
  }

  // Public API
  window.SkillHeedNEP = {
    trackSchoolOnboarding: trackSchoolOnboarding,
    getAssociationCode: function() {
      return Cookies.get('skillheed_partner');
    },
    clearAssociationCode: function() {
      Cookies.delete('skillheed_partner');
    },
    version: '2.0.0'
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
