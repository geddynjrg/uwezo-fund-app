import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { issueTokensForUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { IdentifierType } from '@/generated/prisma';
import { isPsRole } from '@/lib/auth/roles';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeAppPhone(raw?: string): string | undefined {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return undefined;
  let n = digits;
  if (n.startsWith('0') && n.length === 10) n = `254${n.slice(1)}`;
  else if (n.length === 9 && /^[17]/.test(n)) n = `254${n}`;
  if (n.startsWith('254') && n.length === 12) return `+${n}`;
  const trimmed = String(raw || '').trim();
  return trimmed || undefined;
}

function phoneDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

async function findUserByPhone(phone?: string) {
  if (!phone) return null;
  const last9 = phoneDigits(phone).slice(-9);
  if (last9.length !== 9) return null;
  const candidates = await prisma.user.findMany({
    where: { phoneNumber: { contains: last9 } },
    take: 8,
  });
  const matches = candidates.filter(
    (candidate) => phoneDigits(candidate.phoneNumber).slice(-9) === last9,
  );
  if (matches.length === 0) return null;
  return (
    matches.find((candidate) => !candidate.passwordHash) ||
    matches.find(
      (candidate) => candidate.identifierType === IdentifierType.ECITIZEN,
    ) ||
    matches[0]
  );
}

function isUniqueConstraint(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export async function registerWithEmail(email: string, password: string) {
  const normalized = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      identifierType: IdentifierType.EMAIL,
    },
  });

  return issueTokensForUser(user.id);
}

export async function loginWithEmail(email: string, password: string) {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash || isPsRole(user.role)) {
    throw new Error('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return issueTokensForUser(user.id);
}

/**
 * Option A upsert: sign in if account exists; otherwise create email+password
 * (optionally linking phone) on first login.
 */
export async function upsertLoginWithEmailPhone(input: {
  email: string;
  password: string;
  phone?: string;
  createIfMissing?: boolean;
  forceUpdatePassword?: boolean;
}) {
  const email = normalizeEmail(input.email);
  const phone = normalizeAppPhone(input.phone);
  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;

  if (!user) {
    const byPhone = await findUserByPhone(phone);
    const phoneEmail = byPhone?.email?.trim().toLowerCase() || '';
    if (
      byPhone &&
      (!byPhone.passwordHash || !phoneEmail || phoneEmail === email)
    ) {
      user = byPhone;
    }
  }

  if (!user) {
    if (input.createIfMissing === false) {
      throw new Error('Invalid email or password');
    }
    const passwordHash = await hashPassword(input.password);
    try {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          phoneNumber: phone,
          identifierType: IdentifierType.EMAIL,
        },
      });
      created = true;
    } catch (error) {
      if (!phone || !isUniqueConstraint(error)) throw error;
      const byPhone = await findUserByPhone(phone);
      if (byPhone && !byPhone.passwordHash) {
        user = byPhone;
      } else {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            identifierType: IdentifierType.EMAIL,
          },
        });
        created = true;
      }
    }
  }

  if (isPsRole(user.role)) {
    throw new Error('Invalid email or password');
  }
  if (user.passwordHash && !input.forceUpdatePassword) {
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }
  } else {
    const passwordHash = await hashPassword(input.password);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        email: user.email || email,
      },
    });
  }
  if (phone && phoneDigits(phone) !== phoneDigits(user.phoneNumber)) {
    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { phoneNumber: phone },
      });
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
    }
  }

  return {
    created,
    tokens: await issueTokensForUser(user.id),
  };
}

export async function loginPsWithEmail(email: string, password: string) {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash || !isPsRole(user.role)) {
    throw new Error('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return issueTokensForUser(user.id);
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      name: true,
      identifierType: true,
      role: true,
    },
  });
}

export async function changePsPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, role: true },
  });

  if (!user?.passwordHash || !isPsRole(user.role)) {
    throw new Error('Unable to change password');
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
