import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'stream'

function getS3Client() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error('Missing Cloudflare R2 environment variables')
  }
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
    bucketName: R2_BUCKET_NAME,
  }
}

function isReadable(value: unknown): value is Readable {
  return typeof value === 'object' && value !== null && typeof (value as any).pipe === 'function'
}

async function streamToBuffer(
  body: Readable | AsyncIterable<Uint8Array> | string | Uint8Array | null | undefined,
): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0)
  }

  if (typeof body === 'string') {
    return Buffer.from(body)
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  if (isReadable(body)) {
    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks)
  }

  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export async function getJson<T>(key: string): Promise<T> {
  const data = await getObject(key)
  return JSON.parse(data.toString('utf-8')) as T
}

export async function putJson(key: string, data: unknown): Promise<void> {
  const { client, bucketName } = getS3Client()
  const body = JSON.stringify(data)
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  )
}

export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const { client, bucketName } = getS3Client()
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType })
  return getSignedUrl(client, command, { expiresIn })
}

export async function getObject(key: string): Promise<Buffer> {
  const { client, bucketName } = getS3Client()
  const response = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }))
  return streamToBuffer(response.Body as any)
}

export async function objectExists(key: string): Promise<boolean> {
  const { client, bucketName } = getS3Client()
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
    return true
  } catch (error) {
    const code = (error as any)?.$metadata?.httpStatusCode
    const name = (error as Error).name
    if (code === 404 || name === 'NotFound' || name === 'NoSuchKey') {
      return false
    }
    throw error
  }
}
