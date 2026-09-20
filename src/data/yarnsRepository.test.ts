import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProject, deleteProject } from './projectsRepository'
import {
  addYarnUsage,
  createYarn,
  deleteYarn,
  getAllProjectYarns,
  getAllYarnUsages,
  getProjectYarns,
  getYarnUsages,
  linkYarnToProject,
  setYarnImage,
} from './yarnsRepository'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function createTestProject() {
  return createProject({ name: 'Pull X', craft: 'knitting', description: '', colorKey: 'prune' })
}

describe('deleteYarn', () => {
  it('cascades to project links, usages and the photo', async () => {
    const yarn = await createYarn({ name: 'Malabrigo Rios', skeinCount: 5 })
    const project = await createTestProject()
    await linkYarnToProject(project.id, yarn.id, 200, 'g')
    await addYarnUsage({ yarnId: yarn.id, projectId: project.id, value: 100, unit: 'g', usedAt: '2024-01-01' })
    await setYarnImage(yarn.id, new Blob(['x']))

    await deleteYarn(yarn.id)

    expect(await db.yarns.get(yarn.id)).toBeUndefined()
    expect(await getProjectYarns(project.id)).toHaveLength(0)
    expect(await getYarnUsages(yarn.id)).toHaveLength(0)
    expect(await db.yarnImages.get(yarn.id)).toBeUndefined()
  })
})

describe('deleteProject and yarn consumption', () => {
  it('keeps consumption in stock (projectId set to null) when keepYarnUsage is true', async () => {
    const yarn = await createYarn({ name: 'Malabrigo Rios', skeinCount: 5 })
    const project = await createTestProject()
    await linkYarnToProject(project.id, yarn.id, 200, 'g')
    const usage = await addYarnUsage({
      yarnId: yarn.id,
      projectId: project.id,
      value: 100,
      unit: 'g',
      usedAt: '2024-01-01',
    })

    await deleteProject(project.id, true)

    expect(await getAllProjectYarns()).toHaveLength(0)
    const usages = await getAllYarnUsages()
    expect(usages).toHaveLength(1)
    expect(usages[0]!.id).toBe(usage.id)
    expect(usages[0]!.projectId).toBeNull()
  })

  it('deletes the consumption (returns yarn to stock) when keepYarnUsage is false', async () => {
    const yarn = await createYarn({ name: 'Malabrigo Rios', skeinCount: 5 })
    const project = await createTestProject()
    await linkYarnToProject(project.id, yarn.id, 200, 'g')
    await addYarnUsage({ yarnId: yarn.id, projectId: project.id, value: 100, unit: 'g', usedAt: '2024-01-01' })

    await deleteProject(project.id, false)

    expect(await getAllProjectYarns()).toHaveLength(0)
    expect(await getAllYarnUsages()).toHaveLength(0)
  })

  it('never touches usages not tied to any project', async () => {
    const yarn = await createYarn({ name: 'Malabrigo Rios', skeinCount: 5 })
    const project = await createTestProject()
    await addYarnUsage({ yarnId: yarn.id, projectId: null, value: 50, unit: 'g', usedAt: '2024-01-01' })

    await deleteProject(project.id, false)

    expect(await getAllYarnUsages()).toHaveLength(1)
  })
})

describe('linkYarnToProject', () => {
  it('keeps a single link per project/yarn pair', async () => {
    const yarn = await createYarn({ name: 'Malabrigo Rios', skeinCount: 5 })
    const project = await createTestProject()

    await linkYarnToProject(project.id, yarn.id, 200, 'g')
    await linkYarnToProject(project.id, yarn.id, 300, 'g')

    const links = await getProjectYarns(project.id)
    expect(links).toHaveLength(1)
    expect(links[0]!.plannedValue).toBe(300)
  })
})
