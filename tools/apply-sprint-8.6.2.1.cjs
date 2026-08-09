const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function replaceRequired(rel, before, after, label) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');

  if (s.includes(after)) {
    console.log('OK', label, '(já aplicado)');
    return;
  }

  if (!s.includes(before)) {
    throw new Error(`Trecho esperado não encontrado em ${rel}: ${label}`);
  }

  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', label);
}

console.log('=== Sprint 8.6.2.1 — Health E2E Storage Hotfix ===');

const rel = 'apps/api/test/app.e2e-spec.ts';

replaceRequired(
  rel,
  `import { RedisService } from '../src/modules/redis/redis.service';
import { HashUtil } from '../src/common/utils/hash.util';`,
  `import { RedisService } from '../src/modules/redis/redis.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { HashUtil } from '../src/common/utils/hash.util';`,
  'StorageService importado no E2E'
);

replaceRequired(
  rel,
  `  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({
      status: 'ready',
      exists: jest.fn().mockResolvedValue(0),
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
    }),
  };

  let accessToken: string;`,
  `  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({
      status: 'ready',
      exists: jest.fn().mockResolvedValue(0),
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(60000),
    }),
  };

  const mockStorageService = {
    checkHealth: jest.fn().mockResolvedValue(true),
  };

  let accessToken: string;`,
  'Storage health mock definido'
);

replaceRequired(
  rel,
  `      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();`,
  `      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .compile();`,
  'StorageService sobrescrito no TestingModule'
);

replaceRequired(
  rel,
  `  describe('Health Endpoints with PostgreSQL & Redis Check', () => {`,
  `  describe('Health Endpoints with PostgreSQL, Redis & Object Storage Check', () => {`,
  'descrição do health atualizada'
);

replaceRequired(
  rel,
  `      expect(res.body.data.services).toEqual({ database: 'up', redis: 'up' });`,
  `      expect(res.body.data.services).toEqual({
        database: 'up',
        redis: 'up',
        objectStorage: 'up',
      });`,
  'health espera objectStorage up'
);

replaceRequired(
  rel,
  `      expect(res.body.data.status).toBe('ready');
    });
  });`,
  `      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.services).toEqual({
        database: 'up',
        redis: 'up',
        objectStorage: 'up',
      });
      expect(mockStorageService.checkHealth).toHaveBeenCalled();
    });
  });`,
  'readiness valida objectStorage'
);

console.log('Hotfix Sprint 8.6.2.1 aplicado.');
