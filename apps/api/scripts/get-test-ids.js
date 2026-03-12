const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const reqs = await p.request.findMany({
    where: {
      category: { in: ["heating", "leak", "electrical", "roof", "smoke detector", "painting"] },
      unit: { building: { name: "Legal Test Building" } },
    },
    select: { id: true, category: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  
  console.log("Test requests:");
  reqs.forEach((r) => console.log(`  ${r.category.padEnd(16)} | ${r.id} | ${r.status}`));
  
  await p.$disconnect();
})();
