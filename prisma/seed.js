import 'dotenv/config'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../server/generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed reference data')
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

try {
  const university = await prisma.university.upsert({
    where: { name_country: { name: 'Nanyang Technological University', country: 'Singapore' } },
    update: { shortName: 'NTU', website: 'https://www.ntu.edu.sg' },
    create: {
      name: 'Nanyang Technological University',
      shortName: 'NTU',
      country: 'Singapore',
      website: 'https://www.ntu.edu.sg'
    }
  })

  const school = await prisma.school.upsert({
    where: { universityId_name: { universityId: university.id, name: 'Nanyang Business School' } },
    update: { shortName: 'NBS' },
    create: {
      universityId: university.id,
      name: 'Nanyang Business School',
      shortName: 'NBS'
    }
  })

  await prisma.programme.upsert({
    where: { schoolId_name: { schoolId: school.id, name: 'Business' } },
    update: { degreeType: 'Bachelor', durationYears: 3 },
    create: {
      schoolId: school.id,
      name: 'Business',
      degreeType: 'Bachelor',
      durationYears: 3
    }
  })

  await prisma.opportunitySource.upsert({
    where: { adapterKey: 'devpost' },
    update: { name: 'Devpost', slug: 'devpost', baseUrl: 'https://devpost.com/hackathons' },
    create: { name: 'Devpost', slug: 'devpost', adapterKey: 'devpost', baseUrl: 'https://devpost.com/hackathons', enabled: true }
  })
} finally {
  await prisma.$disconnect()
}
