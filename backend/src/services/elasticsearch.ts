import { getElasticsearchClient } from '../config/elasticsearch';

export interface EmailDocument {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  senderEmail: string;
  batchId: string | null;
  createdAt: Date;
}

export async function indexEmail(doc: EmailDocument): Promise<void> {
  try {
    const client = getElasticsearchClient();
    await client.index({
      index: 'emails',
      id: doc.id,
      document: {
        ...doc,
        scheduledAt: doc.scheduledAt.toISOString(),
        sentAt: doc.sentAt?.toISOString() || null,
        createdAt: doc.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('⚠️ Elasticsearch indexing failed (non-fatal):', error);
  }
}

export async function searchEmails(
  userId: string,
  query: string,
  filters?: { status?: string; from?: string; to?: string },
  page: number = 1,
  limit: number = 20
): Promise<{ results: EmailDocument[]; total: number }> {
  try {
    const client = getElasticsearchClient();

    const must: any[] = [
      { term: { userId } },
    ];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['recipientEmail', 'subject', 'body'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (filters?.status) {
      must.push({ term: { status: filters.status } });
    }

    const searchFilters: any[] = [];
    if (filters?.from || filters?.to) {
      const range: any = {};
      if (filters.from) range.gte = filters.from;
      if (filters.to) range.lte = filters.to;
      searchFilters.push({ range: { scheduledAt: range } });
    }

    const result = await client.search({
      index: 'emails',
      body: {
        query: {
          bool: {
            must,
            filter: searchFilters,
          },
        },
        from: (page - 1) * limit,
        size: limit,
        sort: [{ createdAt: { order: 'desc' } }],
      },
    });

    const hits = result.hits.hits;
    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : result.hits.total?.value || 0;

    return {
      results: hits.map((hit: any) => hit._source as EmailDocument),
      total,
    };
  } catch (error) {
    console.log('ℹ️ Elasticsearch unavailable, falling back to database search');
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const whereClause: any = {
        userId,
      };

      if (filters?.status) {
        whereClause.status = filters.status;
      }

      if (query && query.trim()) {
        whereClause.OR = [
          { recipientEmail: { contains: query } },
          { subject: { contains: query } },
          { body: { contains: query } },
        ];
      }

      const [jobs, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: whereClause,
          include: { sender: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.emailJob.count({ where: whereClause }),
      ]);

      const results: EmailDocument[] = jobs.map((job) => ({
        id: job.id,
        userId: job.userId,
        senderId: job.senderId,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledAt: job.scheduledAt,
        sentAt: job.sentAt,
        senderEmail: job.sender?.email || '',
        batchId: job.batchId,
        createdAt: job.createdAt,
      }));

      return { results, total };
    } catch (dbError) {
      console.error('⚠️ Database search fallback error:', dbError);
      return { results: [], total: 0 };
    }
  }
}
