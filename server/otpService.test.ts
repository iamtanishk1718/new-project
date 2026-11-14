import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestOtpChallenge,
  verifyOtpChallenge,
  verifyOtpSessionToken,
  revokeOtpSessionToken,
  resetOtpStateForTests,
  OtpServiceError,
} from './otpService.ts';

test('OTP authentication issues 6-digit code, verifies once, and validates session token', async () => {
  resetOtpStateForTests();

  const challenge = await requestOtpChallenge('tanishk@tejasvi.space', 'email', 'Tanishk Sharma');
  assert.equal(challenge.channel, 'email');
  assert.match(challenge.dispatchPreviewCode || '', /^\d{6}$/);
  assert.ok(challenge.maskedTarget.includes('@tejasvi.space'));

  // Reject wrong code and decrement remaining attempts
  assert.throws(
    () => verifyOtpChallenge('tanishk@tejasvi.space', 'email', '000000', challenge.challengeToken),
    (err: unknown) => err instanceof OtpServiceError && err.statusCode === 401
  );

  // Verify valid code
  const session = verifyOtpChallenge(
    'tanishk@tejasvi.space',
    'email',
    challenge.dispatchPreviewCode!,
    challenge.challengeToken
  );
  assert.equal(session.user.team, 'Tejasvi');
  assert.equal(session.user.displayName, 'Tanishk Sharma');

  // Verify issued session token
  const validatedUser = verifyOtpSessionToken(session.token);
  assert.ok(validatedUser);
  assert.equal(validatedUser?.identifier, 'tanishk@tejasvi.space');

  // Replay attempt must fail
  assert.throws(
    () =>
      verifyOtpChallenge(
        'tanishk@tejasvi.space',
        'email',
        challenge.dispatchPreviewCode!
      ),
    (err: unknown) => err instanceof OtpServiceError && err.statusCode === 404
  );

  // Revocation invalidates session token
  revokeOtpSessionToken(session.token);
  assert.equal(verifyOtpSessionToken(session.token), null);
});

test('OTP authentication supports mobile phone numbers and locks out after 5 failed attempts', async () => {
  resetOtpStateForTests();

  const challenge = await requestOtpChallenge('+91 98765 43210', 'phone', 'Shivam Sharma');
  assert.equal(challenge.channel, 'phone');
  assert.ok(challenge.maskedTarget.endsWith('3210'));

  for (let i = 0; i < 5; i++) {
    assert.throws(
      () => verifyOtpChallenge('+919876543210', 'phone', '111111'),
      (err: unknown) => err instanceof OtpServiceError && err.statusCode === 401
    );
  }

  // Even the real code should now be locked/cleared
  assert.throws(
    () => verifyOtpChallenge('+919876543210', 'phone', challenge.dispatchPreviewCode!),
    (err: unknown) => err instanceof OtpServiceError && err.statusCode === 404
  );
});
