import { Client } from '@elastic/elasticsearch';
import { config } from './index';

let esClient: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: config.ELASTICSEARCH_URL,
    });
  }
  return esClient;
}

export async function initElasticsearch(): Promise<void> {
  const client = getElasticsearchClient();

  try {
    const indexExists = await client.indices.exists({ index: 'emails' });

    if (!indexExists) {
      await client.indices.create({
        index: 'emails',
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'trim'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              recipientEmail: { type: 'text', analyzer: 'email_analyzer' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              senderEmail: { type: 'keyword' },
              batchId: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log('✅ Elasticsearch index "emails" created');
    } else {
      console.log('✅ Elasticsearch index "emails" already exists');
    }
  } catch (error) {
    console.error('⚠️ Elasticsearch initialization failed (non-fatal):', error);
  }
}
