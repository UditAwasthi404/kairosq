import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async findOrCreateByClerkId(clerkUserId: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { clerkUserId },
      create: { clerkUserId },
      update: {},
    });
  }

  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { clerkUserId } });
  }

  /**
   * Deletes all Kairos data owned by this Clerk user.
   * Does not delete the Clerk identity itself.
   */
  async deleteAllDataForClerkUser(clerkUserId: string): Promise<{
    deletedObservations: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        observations: { select: { id: true, storageKey: true } },
      },
    });

    if (!user) {
      throw new NotFoundException({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      });
    }

    const storageKeys = user.observations.map((o) => o.storageKey);
    const deletedObservations = user.observations.length;

    // Cascades observations/chunks/projects/conversations/topics/entities links.
    await this.prisma.user.delete({ where: { id: user.id } });

    for (const key of storageKeys) {
      try {
        await this.storage.delete(key);
      } catch {
        // Best-effort cloud cleanup after DB delete.
      }
    }

    return { deletedObservations };
  }
}
