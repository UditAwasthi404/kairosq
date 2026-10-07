import { Injectable, NotFoundException } from '@nestjs/common';
import { ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  toObservationResponse,
  type ObservationResponse,
} from '../observations/observation.mapper';
import {
  validateAddObservation,
  validateBulkAddObservations,
  validateCreateProject,
  validateUpdateProject,
  type AddObservationBody,
  type BulkAddObservationsBody,
  type CreateProjectBody,
  type UpdateProjectBody,
} from './projects.validation';

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  observationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDetail = ProjectSummary & {
  observations: ObservationResponse[];
  nextCursor: string | null;
};

const observationInclude = {
  observationTopics: { include: { topic: true } },
  observationEntities: { include: { entity: true } },
  projectObservations: { include: { project: true } },
  _count: { select: { chunks: true } },
} as const;

const completedMembershipWhere = {
  observation: { processingStatus: ProcessingStatus.COMPLETED },
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async listForClerkUser(
    clerkUserId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: ProjectSummary[]; nextCursor: string | null }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

    const rows = await this.prisma.project.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      ...(options?.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      include: {
        _count: {
          select: {
            projectObservations: { where: completedMembershipWhere },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const items = page.map((row) => toSummary(row));

    return {
      items,
      nextCursor:
        rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getForClerkUser(
    clerkUserId: string,
    projectId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<ProjectDetail> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const project = await this.findOwnedProject(user.id, projectId);
    const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);

    const links = await this.prisma.projectObservation.findMany({
      where: {
        projectId: project.id,
        ...completedMembershipWhere,
      },
      orderBy: [{ createdAt: 'desc' }, { observationId: 'asc' }],
      ...(options?.cursor
        ? {
            cursor: {
              projectId_observationId: {
                projectId: project.id,
                observationId: options.cursor,
              },
            },
            skip: 1,
          }
        : {}),
      take: limit + 1,
      include: {
        observation: { include: observationInclude },
      },
    });

    const page = links.slice(0, limit);
    const observationCount = await this.prisma.projectObservation.count({
      where: {
        projectId: project.id,
        ...completedMembershipWhere,
      },
    });

    return {
      ...toSummary({
        ...project,
        _count: { projectObservations: observationCount },
      }),
      observations: page.map((link) => toObservationResponse(link.observation)),
      nextCursor:
        links.length > limit
          ? (page[page.length - 1]?.observationId ?? null)
          : null,
    };
  }

  async createForClerkUser(
    clerkUserId: string,
    body: CreateProjectBody,
  ): Promise<ProjectSummary> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const input = validateCreateProject(body);
    const project = await this.prisma.project.create({
      data: {
        userId: user.id,
        name: input.name,
        description: input.description,
      },
    });
    return toSummary({
      ...project,
      _count: { projectObservations: 0 },
    });
  }

  async updateForClerkUser(
    clerkUserId: string,
    projectId: string,
    body: UpdateProjectBody,
  ): Promise<ProjectSummary> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const existing = await this.findOwnedProject(user.id, projectId);
    const input = validateUpdateProject(body);
    const project = await this.prisma.project.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      },
      include: {
        _count: {
          select: {
            projectObservations: { where: completedMembershipWhere },
          },
        },
      },
    });
    return toSummary(project);
  }

  async deleteForClerkUser(
    clerkUserId: string,
    projectId: string,
  ): Promise<void> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const existing = await this.findOwnedProject(user.id, projectId);
    await this.prisma.project.delete({ where: { id: existing.id } });
  }

  async addObservationForClerkUser(
    clerkUserId: string,
    projectId: string,
    body: AddObservationBody,
  ): Promise<{ projectId: string; observationId: string; created: boolean }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const project = await this.findOwnedProject(user.id, projectId);
    const observationId = validateAddObservation(body);
    await this.assertOwnedObservation(user.id, observationId);

    try {
      await this.prisma.projectObservation.create({
        data: {
          projectId: project.id,
          observationId,
        },
      });
      return { projectId: project.id, observationId, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { projectId: project.id, observationId, created: false };
      }
      throw error;
    }
  }

  async addObservationsBulkForClerkUser(
    clerkUserId: string,
    projectId: string,
    body: BulkAddObservationsBody,
  ): Promise<{
    projectId: string;
    added: string[];
    alreadyPresent: string[];
  }> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const project = await this.findOwnedProject(user.id, projectId);
    const observationIds = validateBulkAddObservations(body);

    const owned = await this.prisma.observation.findMany({
      where: {
        userId: user.id,
        id: { in: observationIds },
      },
      select: { id: true },
    });
    if (owned.length !== observationIds.length) {
      throw new NotFoundException({
        error: {
          code: 'OBSERVATION_NOT_FOUND',
          message: 'One or more observations were not found.',
        },
      });
    }

    const existing = await this.prisma.projectObservation.findMany({
      where: {
        projectId: project.id,
        observationId: { in: observationIds },
      },
      select: { observationId: true },
    });
    const already = new Set(existing.map((row) => row.observationId));
    const toCreate = observationIds.filter((id) => !already.has(id));

    if (toCreate.length > 0) {
      await this.prisma.projectObservation.createMany({
        data: toCreate.map((observationId) => ({
          projectId: project.id,
          observationId,
        })),
        skipDuplicates: true,
      });
    }

    return {
      projectId: project.id,
      added: toCreate,
      alreadyPresent: observationIds.filter((id) => already.has(id)),
    };
  }

  async removeObservationForClerkUser(
    clerkUserId: string,
    projectId: string,
    observationId: string,
  ): Promise<void> {
    const user = await this.users.findOrCreateByClerkId(clerkUserId);
    const project = await this.findOwnedProject(user.id, projectId);
    await this.assertOwnedObservation(user.id, observationId);

    const result = await this.prisma.projectObservation.deleteMany({
      where: {
        projectId: project.id,
        observationId,
      },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        error: {
          code: 'MEMBERSHIP_NOT_FOUND',
          message: 'Observation is not in this project.',
        },
      });
    }
  }

  private async findOwnedProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found.',
        },
      });
    }
    return project;
  }

  private async assertOwnedObservation(userId: string, observationId: string) {
    const observation = await this.prisma.observation.findFirst({
      where: { id: observationId, userId },
      select: { id: true },
    });
    if (!observation) {
      throw new NotFoundException({
        error: {
          code: 'OBSERVATION_NOT_FOUND',
          message: 'Observation not found.',
        },
      });
    }
  }
}

function toSummary(row: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { projectObservations: number };
}): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    observationCount: row._count.projectObservations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}
