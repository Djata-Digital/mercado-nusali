import * as fs from 'fs';
import * as path from 'path';

describe('API Route Contract - Sprint 8.1.1', () => {
  const srcRoot = path.resolve(__dirname);
  const apiRoot = path.resolve(__dirname, '..');
  const testRoot = path.join(apiRoot, 'test');

  function walk(dir: string, predicate: (file: string) => boolean): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full, predicate);
      return entry.isFile() && predicate(full) ? [full] : [];
    });
  }

  it('api/v1 pertence somente ao prefixo global, nunca aos decorators REST', () => {
    const offenders = walk(
      srcRoot,
      (file) => file.endsWith('.controller.ts'),
    ).flatMap((file) => {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      return lines
        .map((line, index) => ({ line, index: index + 1 }))
        .filter(({ line }) =>
          /@(Controller|Get|Post|Patch|Put|Delete|All|Options|Head)\(\s*['"]\/?api\/v1(?:\/|['"])/.test(
            line,
          ),
        )
        .map(({ line, index }) => ({
          file: path.relative(srcRoot, file),
          line: index,
          decorator: line.trim(),
        }));
    });

    expect(offenders).toEqual([]);
  });

  it('main.ts mantém api/v1 como prefixo global padrão', () => {
    const main = fs.readFileSync(
      path.join(srcRoot, 'main.ts'),
      'utf8',
    );

    expect(main).toContain(
      "configService.get<string>('apiPrefix', 'api/v1')",
    );
    expect(main).toContain('app.setGlobalPrefix(apiPrefix)');
  });

  it('HTTP E2E que chama /api/v1 reproduz o prefixo global do bootstrap', () => {
    const offenders = walk(
      testRoot,
      (file) =>
        file.endsWith('.e2e-spec.ts') &&
        !file.includes(
          `${path.sep}integration${path.sep}`,
        ),
    )
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8');
        const callsApiV1 =
          /(?:\.get|\.post|\.put|\.patch|\.delete)\(\s*['"]\/api\/v1(?:\/|['"])/.test(
            text,
          );

        return (
          callsApiV1 &&
          text.includes('createNestApplication()') &&
          !text.includes('setGlobalPrefix(')
        );
      })
      .map((file) => path.relative(apiRoot, file));

    expect(offenders).toEqual([]);
  });

  it('checkout expõe session como rota canônica e E2E não usa preview legado', () => {
    const controller = fs.readFileSync(
      path.join(
        srcRoot,
        'modules',
        'checkout',
        'checkout.controller.ts',
      ),
      'utf8',
    );

    expect(controller).toContain("@Controller('checkout')");
    expect(controller).toContain("@Post('session')");
    expect(controller).not.toContain("@Post('preview')");

    const sprint3 = fs.readFileSync(
      path.join(testRoot, 'sprint3.e2e-spec.ts'),
      'utf8',
    );

    expect(sprint3).toContain('/api/v1/checkout/session');
    expect(sprint3).not.toContain('/api/v1/checkout/preview');
  });

});
