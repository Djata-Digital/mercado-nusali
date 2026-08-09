import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly publicBucket: string;
  private readonly privateBucket: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('minio.endpoint', 'localhost');
    const port = this.configService.get<number>('minio.port', 9000);
    const useSSL = this.configService.get<boolean>('minio.useSSL', false);
    const accessKey = this.configService.get<string>('minio.accessKey', 'minioadmin');
    const secretKey = this.configService.get<string>('minio.secretKey', 'minioadmin');

    this.publicBucket = this.configService.get<string>('minio.publicBucket', 'nusali-public');
    this.privateBucket = this.configService.get<string>('minio.privateBucket', 'nusali-private');

    const protocol = useSSL ? 'https' : 'http';
    const s3Endpoint = `${protocol}://${endpoint}:${port}`;

    this.s3Client = new S3Client({
      endpoint: s3Endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  async putObject(
    key: string,
    body: Buffer | Uint8Array | Blob | string,
    mimeType: string,
    isPrivate = false,
  ): Promise<string> {
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body as any,
          ContentType: mimeType,
        }),
      );
      return isPrivate ? key : this.getPublicUrl(key);
    } catch (error: any) {
      this.logger.error(`Error uploading object ${key} to ${bucket}: ${error.message}`);
      throw error;
    }
  }

  async deleteObject(key: string, isPrivate = false): Promise<void> {
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    } catch (error: any) {
      this.logger.error(`Error deleting object ${key} from ${bucket}: ${error.message}`);
    }
  }

  async copyObject(sourceKey: string, targetKey: string, isPrivate = true): Promise<void> {
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;
    try {
      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${sourceKey}`,
          Key: targetKey,
        }),
      );
    } catch (error: any) {
      this.logger.error(`Error copying object ${sourceKey} to ${targetKey} in ${bucket}: ${error.message}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      await Promise.all([
        this.s3Client.send(new HeadBucketCommand({ Bucket: this.publicBucket })),
        this.s3Client.send(new HeadBucketCommand({ Bucket: this.privateBucket })),
      ]);
      return true;
    } catch (error: any) {
      this.logger.warn(`Object storage readiness failed: ${error.message}`);
      return false;
    }
  }

  async objectExists(key: string, isPrivate = false): Promise<boolean> {
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key: string): string {
    const endpoint = this.configService.get<string>('minio.endpoint', 'localhost');
    const port = this.configService.get<number>('minio.port', 9000);
    const useSSL = this.configService.get<boolean>('minio.useSSL', false);
    const protocol = useSSL ? 'https' : 'http';
    return `${protocol}://${endpoint}:${port}/${this.publicBucket}/${key}`;
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.privateBucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }
}

@Injectable()
export class MinioService {
  constructor(private readonly storageService: StorageService) {}

  async uploadFile(key: string, body: Buffer, mimeType: string, isPublic = true) {
    const url = await this.storageService.putObject(key, body, mimeType, !isPublic);
    return {
      key,
      bucket: isPublic ? 'nusali-public' : 'nusali-private',
      url,
    };
  }

  async deleteFile(key: string, isPublic = true) {
    if (!key) return;
    await this.storageService.deleteObject(key, !isPublic);
  }

  getPublicUrl(key: string) {
    return this.storageService.getPublicUrl(key);
  }

  async getSignedUrl(key: string, expiresIn = 3600) {
    return this.storageService.getSignedUrl(key, expiresIn);
  }
}
