import jwt from 'jsonwebtoken';
import { IUser } from '../../models/User';
import getSecret from '../aws/get-secret';

interface IUserSecret {
  token: string;
  refreshToken: string;
}

interface IUserToken {
  token: string;
  refreshToken: string;
}

export const generateUserJwtToken = async (
  user: IUser,
): Promise<IUserToken> => {
  const payload = {
    sub: user._id, // Using 'sub' for the user ID
    role: user.role,
    username: user.username,
    clinicId: user.clinicId,
    branchId: user.branchId,
  };

  const secret = await getUserTokenSecret();

  const token = jwt.sign(payload, secret.token, {
    expiresIn: '1h', // Token expires in one hour
  });

  const refreshToken = jwt.sign(
    {
      sub: user._id,
      branchId: user.branchId,
    },
    secret.refreshToken,
    {
      expiresIn: '1d',
    },
  );
  return {
    token,
    refreshToken,
  };
};

/**
 * Fetches the user token secret from the environment variable or AWS Secrets Manager.
 * @returns Returns the user token and refresh token secrets.
 */
const getUserTokenSecret = async (): Promise<IUserSecret> => {
  let secret;
  if (process.env.USER_TOKEN_SECRET) {
    return JSON.parse(process.env.USER_TOKEN_SECRET);
  } else {
    secret = await getSecret('user-token');
    process.env.USER_TOKEN_SECRET = secret;
  }
  return JSON.parse(secret);
};

/**
 * Decodes a JWT token without verifying its authenticity.
 * @param token The JWT token to decode.
 * @returns The decoded token payload if valid, otherwise null.
 */
export const decodeToken = (token: string): any => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};

/**
 * Verifies the token using the secret.
 * @param token The token to verify.
 * @param isRefreshToken A boolean to check if the token is a refresh token.
 * @returns Returns the decoded token.
 */
export const verifyToken = async (
  token: string,
  isRefreshToken: boolean = false,
): Promise<any> => {
  try {
    const secretData = await getUserTokenSecret(); // Fetch the secret for verification
    const secret = isRefreshToken ? secretData.refreshToken : secretData.token;
    return jwt.verify(token, secret);
  } catch (error) {
    console.error('Failed to verify token:', error);
    throw error;
  }
};
