import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export class HashUtil {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static hash(token: string): string {
    return this.hashToken(token);
  }

  static generateRandomToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateOtpCode(length = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }
}
