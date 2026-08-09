const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function replaceRequired(rel, before, after, label) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');

  if (s.includes(after)) {
    console.log('OK', rel, '-', label, '(já aplicado)');
    return;
  }

  if (!s.includes(before)) {
    throw new Error(`Trecho esperado não encontrado em ${rel}: ${label}`);
  }

  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel, '-', label);
}

console.log('=== Sprint 8.5.2.4 — Manifest Response Sanitization Hotfix ===');

const rel = 'apps/api/src/modules/fulfillment/services/manifest.service.ts';

replaceRequired(
  rel,
  `    return updated;
  }

  async dispatchManifest`,
  `    return this.sanitizeManifestResponse(updated);
  }

  async dispatchManifest`,
  'closeManifest devolve resposta sanitizada'
);

replaceRequired(
  rel,
  `    if (manifest.status === ManifestStatus.DISPATCHED) {
      return manifest;
    }`,
  `    if (manifest.status === ManifestStatus.DISPATCHED) {
      return this.sanitizeManifestResponse(manifest);
    }`,
  'dispatch idempotente devolve resposta sanitizada'
);

replaceRequired(
  rel,
  `    return updated;
  }

  async listManifests`,
  `    return this.sanitizeManifestResponse(updated);
  }

  async listManifests`,
  'dispatchManifest devolve resposta sanitizada'
);

console.log('Hotfix Sprint 8.5.2.4 aplicado.');
