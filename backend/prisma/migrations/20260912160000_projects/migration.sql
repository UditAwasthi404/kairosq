-- Projects / collections: user-managed observation groupings (metadata scope only)

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_observations" (
    "projectId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_observations_pkey" PRIMARY KEY ("projectId","observationId")
);

CREATE INDEX "projects_userId_updatedAt_idx" ON "projects"("userId", "updatedAt" DESC);

CREATE INDEX "project_observations_observationId_idx" ON "project_observations"("observationId");

CREATE INDEX "project_observations_projectId_createdAt_idx" ON "project_observations"("projectId", "createdAt" DESC);

ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_observations" ADD CONSTRAINT "project_observations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_observations" ADD CONSTRAINT "project_observations_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
