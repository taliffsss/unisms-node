/**
 * Example: sending a test SMS via the UniSMS API.
 *
 * Run with: npx tsx examples/send-test.ts
 * (or compile with `tsc` / use `ts-node`)
 */
import { UniSmsClient, ApiError, TransportError, UniSmsError } from '../src/index.js';

const secretKey = process.env.UNISMS_SECRET_KEY ?? 'sk_15eba0c5-b301-4626-ae63-6a47c1b2d180';
const recipient = '09055251658';
const content = 'test';

const client = new UniSmsClient(secretKey);

async function main(): Promise<void> {
  try {
    const response = await client.send({ recipient, content });
    console.log('Sent successfully:');
    console.log(response.raw);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API error (${error.statusCode}): ${error.responseBody}`);
    } else if (error instanceof TransportError) {
      console.error(`Transport error: ${error.message}`);
    } else if (error instanceof UniSmsError) {
      console.error(`Error: ${error.message}`);
    } else {
      throw error;
    }
  }
}

void main();
