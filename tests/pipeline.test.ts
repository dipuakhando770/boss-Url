import { describe, it, expect, vi } from 'vitest';
import { processTwoStageShortening } from '../worker/services/shortener';
import { UserRecord, SubscriptionRecord } from '../types';

describe('Two-Stage URL Shortening Pipeline Service', () => {
  const dummyUser: UserRecord = {
    id: 'usr_test_123',
    email: 'tester@example.com',
    password_hash: 'hash',
    salt: 'salt',
    name: 'Tester',
    role: 'user',
    status: 'active',
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const dummySub: SubscriptionRecord = {
    id: 'sub_test_123',
    user_id: 'usr_test_123',
    package_id: 'pkg_starter',
    links_used: 5,
    link_quota: 50,
    starts_at: Date.now(),
    expires_at: Date.now() + 86400000,
    status: 'active',
    created_at: Date.now(),
  };

  it('rejects unregistered domain with exact Bengali message', async () => {
    const mockDb: any = {
      getApprovedDomains: vi.fn().mockResolvedValue(['nasirdigitalhub.com']),
      getUserActiveSubscription: vi.fn().mockResolvedValue(dummySub),
    };

    const res = await processTwoStageShortening(mockDb, {
      originalUrl: 'https://unauthorized-domain.com/landing',
      user: dummyUser,
      stage1Domain: 'https://urlshort.nasirdigitalhub.com',
      stage2ApiUrl: 'http://107.174.37.180/api/links/stage1',
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('DOMAIN_NOT_REGISTERED');
    expect(res.banglaMessage).toBe('এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।');
  });

  it('rejects request when subscription quota is exceeded', async () => {
    const expiredSub: SubscriptionRecord = {
      ...dummySub,
      links_used: 50,
      link_quota: 50,
    };

    const mockDb: any = {
      getApprovedDomains: vi.fn().mockResolvedValue(['nasirdigitalhub.com']),
      getUserActiveSubscription: vi.fn().mockResolvedValue(expiredSub),
    };

    const res = await processTwoStageShortening(mockDb, {
      originalUrl: 'https://nasirdigitalhub.com/landing',
      user: dummyUser,
      stage1Domain: 'https://urlshort.nasirdigitalhub.com',
      stage2ApiUrl: 'http://107.174.37.180/api/links/stage1',
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('QUOTA_EXCEEDED');
  });

  it('successfully persists Stage 1 and maps Stage 2 VPS URL upon VPS success', async () => {
    // Mock database methods
    const mockDb: any = {
      getApprovedDomains: vi.fn().mockResolvedValue(['nasirdigitalhub.com']),
      getUserActiveSubscription: vi.fn().mockResolvedValue(dummySub),
      getLinkByStage1Code: vi.fn().mockResolvedValue(null),
      createStage1Link: vi.fn().mockResolvedValue(undefined),
      updateStage2Completed: vi.fn().mockResolvedValue(undefined),
      incrementSubscriptionUsage: vi.fn().mockResolvedValue(undefined),
      getLinkById: vi.fn().mockResolvedValue({
        id: 'lnk_123',
        stage1_code: 'testcode',
        stage1_url: 'https://urlshort.nasirdigitalhub.com/testcode',
        final_url: 'http://107.174.37.180/s1_xyz789',
        status: 'completed',
      }),
    };

    // Mock global fetch for Stage 2 VPS API
    const mockVpsResponse = {
      error: false,
      message: 'Stage 1 link created successfully',
      success: true,
      mode: 'local',
      stage1_id: 88,
      stage1_code: 's1_xyz789',
      stage1_url: 'http://107.174.37.180/s1_xyz789',
      original_url: 'https://urlshort.nasirdigitalhub.com/testcode',
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVpsResponse,
    });

    const res = await processTwoStageShortening(mockDb, {
      originalUrl: 'https://nasirdigitalhub.com/campaign-pro',
      customCode: 'testcode',
      user: dummyUser,
      stage1Domain: 'https://urlshort.nasirdigitalhub.com',
      stage2ApiUrl: 'http://107.174.37.180/api/links/stage1',
    });

    expect(res.success).toBe(true);
    expect(res.finalUrl).toBe('http://107.174.37.180/s1_xyz789');
    expect(mockDb.createStage1Link).toHaveBeenCalled();
    expect(mockDb.updateStage2Completed).toHaveBeenCalledWith(
      expect.any(String),
      's1_xyz789',
      88,
      'http://107.174.37.180/s1_xyz789'
    );
    expect(mockDb.incrementSubscriptionUsage).toHaveBeenCalledWith('sub_test_123');

    global.fetch = originalFetch;
  });

  it('fails safely and persists failure without fabricating success if VPS is down', async () => {
    const mockDb: any = {
      getApprovedDomains: vi.fn().mockResolvedValue(['nasirdigitalhub.com']),
      getUserActiveSubscription: vi.fn().mockResolvedValue(dummySub),
      getLinkByStage1Code: vi.fn().mockResolvedValue(null),
      createStage1Link: vi.fn().mockResolvedValue(undefined),
      updateStage2Failed: vi.fn().mockResolvedValue(undefined),
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused to 107.174.37.180'));

    const res = await processTwoStageShortening(mockDb, {
      originalUrl: 'https://nasirdigitalhub.com/campaign-pro',
      user: dummyUser,
      stage1Domain: 'https://urlshort.nasirdigitalhub.com',
      stage2ApiUrl: 'http://107.174.37.180/api/links/stage1',
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe(502);
    expect(res.errorCode).toBe('STAGE2_VPS_FAILED');
    expect(mockDb.updateStage2Failed).toHaveBeenCalled();

    global.fetch = originalFetch;
  });
});
