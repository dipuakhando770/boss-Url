// English and Bangla Translations Dictionary

export type Language = 'en' | 'bn';

export const translations = {
  en: {
    // Brand
    brandName: 'Boss URL Shortener',
    brandTagline: 'Two-Stage Enterprise Shortening Platform',
    
    // Nav
    navHome: 'Home',
    navDashboard: 'Dashboard',
    navAdmin: 'Admin Panel',
    navLogin: 'Login',
    navRegister: 'Get Started',
    navLogout: 'Sign Out',
    
    // Hero & Shortening
    heroTitle: 'Shorten, Track & Supercharge Your Links',
    heroSubtitle: 'Next-generation two-stage link shortening engine built on Cloudflare edge network with multi-tier failover and real-time analytics.',
    inputPlaceholder: 'Paste long destination URL here (e.g. https://nasirdigitalhub.com/...)',
    customCodePlaceholder: 'Custom alias (optional, e.g. promo2026)',
    titlePlaceholder: 'Link label or campaign title (optional)',
    shortenBtn: 'Shorten URL Now',
    shortening: 'Processing Shortening Pipeline...',
    successTitle: 'Link Shortened Successfully!',
    copyLink: 'Copy Link',
    copied: 'Copied to Clipboard!',
    checkDomainBtn: 'Verify Domain Approval',
    stage1Badge: 'Stage 1 Cloudflare Protected',
    stage2Badge: 'Stage 2 VPS Engine Verified',
    
    // Domain Approval Alert
    domainNotApprovedError: 'This domain is not approved yet. Please contact admin for approval.',
    domainNotApprovedBn: 'এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।',
    
    // Dashboard
    dashboardTitle: 'User Control Center',
    quotaUsed: 'Quota Consumption',
    linksCreated: 'Links Created',
    totalClicks: 'Total Clicks',
    activePlan: 'Current Plan',
    expiresOn: 'Expires on',
    daysRemaining: 'days remaining',
    searchLinks: 'Search links by URL or alias...',
    noLinksFound: 'No links found matching your criteria.',
    originalUrl: 'Original Destination',
    shortUrl: 'Shortened Link',
    clicks: 'Clicks',
    created: 'Created',
    status: 'Status',
    actions: 'Actions',
    analytics: 'Analytics',
    delete: 'Delete',
    
    // Admin
    adminDashboard: 'Executive Administration',
    adminUsers: 'Users Directory',
    adminLinks: 'All System Links',
    adminPackages: 'Subscription Packages',
    adminDomains: 'Approved Domains Allowlist',
    adminAudit: 'Security Audit Logs',
    adminStats: 'Overview Metrics',
    
    // Auth
    loginTitle: 'Welcome Back to Boss URL',
    loginSubtitle: 'Log into your account to manage your shortened links.',
    registerTitle: 'Create Your Free Account',
    registerSubtitle: 'Get instant access with 50 free short links and full analytics.',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    nameLabel: 'Full Name',
    alreadyHaveAccount: 'Already have an account? Log in',
    dontHaveAccount: "Don't have an account? Sign up free",
    
    // Common
    loading: 'Loading...',
    save: 'Save Changes',
    cancel: 'Cancel',
    confirm: 'Confirm',
  },
  bn: {
    // Brand
    brandName: 'বস ইউআরএল শর্টনার',
    brandTagline: 'টু-স্টেজ এন্টারপ্রাইজ শর্টনিং প্ল্যাটফর্ম',
    
    // Nav
    navHome: 'হোম',
    navDashboard: 'ড্যাশবোর্ড',
    navAdmin: 'অ্যাডমিন প্যানেল',
    navLogin: 'লগইন',
    navRegister: 'শুরু করুন',
    navLogout: 'লগআউট',
    
    // Hero & Shortening
    heroTitle: 'লিংক ছোট করুন, ট্র্যাক করুন ও সাফল্য বাড়ান',
    heroSubtitle: 'ক্লাউডফ্লেয়ার এজ নেটওয়ার্ক এবং টু-স্টেজ ইঞ্জিনের মাধ্যমে নিরাপদ, নির্ভরযোগ্য এবং রিয়েল-টাইম অ্যানালিটিক্স সহ ইউআরএল শর্টনার।',
    inputPlaceholder: 'আপনার বড় লিংকটি এখানে পেস্ট করুন (যেমন https://nasirdigitalhub.com/...)',
    customCodePlaceholder: 'কাস্টম কোড (ঐচ্ছিক, যেমন promo2026)',
    titlePlaceholder: 'লিংকের নাম বা টাইটেল (ঐচ্ছিক)',
    shortenBtn: 'লিংক ছোট করুন',
    shortening: 'শর্টনিং প্রসেস চলছে...',
    successTitle: 'লিংক সফলভাবে তৈরি হয়েছে!',
    copyLink: 'লিংক কপি করুন',
    copied: 'কপি করা হয়েছে!',
    checkDomainBtn: 'ডোমেইন অনুমোদন যাচাই করুন',
    stage1Badge: 'স্টেজ ১ ক্লাউডফ্লেয়ার সুরক্ষিত',
    stage2Badge: 'স্টেজ ২ ভিপিএস ইঞ্জিন অনুমোদিত',
    
    // Domain Approval Alert
    domainNotApprovedError: 'এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।',
    domainNotApprovedBn: 'এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।',
    
    // Dashboard
    dashboardTitle: 'ব্যবহারকারী ড্যাশবোর্ড',
    quotaUsed: 'ব্যবহৃত কোটা',
    linksCreated: 'তৈরি করা লিংক',
    totalClicks: 'মোট ক্লিক',
    activePlan: 'বর্তমান প্যাকেজ',
    expiresOn: 'মেয়াদ শেষ',
    daysRemaining: 'দিন বাকি',
    searchLinks: 'লিংক বা কোড দিয়ে সার্চ করুন...',
    noLinksFound: 'কোন লিংক পাওয়া যায়নি।',
    originalUrl: 'মূল লিংক',
    shortUrl: 'শর্ট লিংক',
    clicks: 'ক্লিক',
    created: 'তৈরির তারিখ',
    status: 'অবস্থা',
    actions: 'অ্যাকশন',
    analytics: 'পরিসংখ্যান',
    delete: 'মুছুন',
    
    // Admin
    adminDashboard: 'অ্যাডমিন ড্যাশবোর্ড',
    adminUsers: 'ব্যবহারকারী তালিকা',
    adminLinks: 'সকল লিংক',
    adminPackages: 'সাবস্ক্রিপশন প্যাকেজ',
    adminDomains: 'অনুমোদিত ডোমেইন তালিকা',
    adminAudit: 'অডিট লগ',
    adminStats: 'সারসংক্ষেপ মেট্রিক',
    
    // Auth
    loginTitle: 'বস ইউআরএল-এ স্বাগতম',
    loginSubtitle: 'আপনার অ্যাকাউন্টে লগইন করে লিংকগুলো পরিচালনা করুন।',
    registerTitle: 'নতুন অ্যাকাউন্ট তৈরি করুন',
    registerSubtitle: '৫০টি ফ্রি লিংক কোটা ও সম্পূর্ণ অ্যানালিটিক্স সহ আজই শুরু করুন।',
    emailLabel: 'ইমেইল অ্যাড্রেস',
    passwordLabel: 'পাসওয়ার্ড',
    nameLabel: 'আপনার নাম',
    alreadyHaveAccount: 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন',
    dontHaveAccount: 'কোন অ্যাকাউন্ট নেই? ফ্রিতে রেজিস্ট্রেশন করুন',
    
    // Common
    loading: 'লোড হচ্ছে...',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    confirm: 'নিশ্চিত করুন',
  }
};
