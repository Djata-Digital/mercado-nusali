-- Sprint 7.4.7: dedicated least-privilege permissions for Refund Admin API.
INSERT INTO "permissions" ("id", "slug", "name", "description", "createdAt", "updatedAt") VALUES
('74700000-0000-4000-8000-000000000001', 'refund:admin:read', 'Ler Operações de Refund', 'Consultar operações, histórico, métricas e alertas de refunds', NOW(), NOW()),
('74700000-0000-4000-8000-000000000002', 'refund:admin:operate', 'Operar Refunds', 'Executar reconciliação manual e recuperação operacional de refunds', NOW(), NOW()),
('74700000-0000-4000-8000-000000000003', 'refund:admin:report', 'Exportar Relatórios de Refund', 'Consultar e exportar relatórios financeiros de refunds', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "updatedAt" = NOW();

-- Preserve current ADMIN/SUPER_ADMIN operability while separating capabilities.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('ADMIN', 'SUPER_ADMIN')
  AND p."slug" IN ('refund:admin:read', 'refund:admin:operate', 'refund:admin:report')
ON CONFLICT DO NOTHING;
