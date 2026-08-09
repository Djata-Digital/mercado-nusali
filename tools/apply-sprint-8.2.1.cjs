const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

if (!fs.existsSync(path.join(ROOT, 'src', 'App.tsx'))) {
  throw new Error(
    'src/App.tsx não encontrado. Execute este script na raiz do mercado-nusali.',
  );
}

const payload = {"src/config/api.ts": "Y29uc3QgZW52ID0gaW1wb3J0Lm1ldGEuZW52OwoKY29uc3QgaXNQcm9kdWN0aW9uID0gZW52LlBST0Q7CmNvbnN0IGZha2VSZXF1ZXN0ZWQgPSBlbnYuVklURV9VU0VfRkFLRV9BUEkgPT09ICd0cnVlJzsKCmlmIChpc1Byb2R1Y3Rpb24gJiYgZmFrZVJlcXVlc3RlZCkgewogIHRocm93IG5ldyBFcnJvcigKICAgICdWSVRFX1VTRV9GQUtFX0FQST10cnVlIMOpIHByb2liaWRvIGVtIHByb2R1w6fDo28uIE8gTWVyY2FkbyBOdXNhbGkgbsOjbyBwb2RlIGluaWNpYXIgY29tIGRhZG9zIHNpbXVsYWRvcy4nLAogICk7Cn0KCmNvbnN0IGFwaVVybCA9CiAgZW52LlZJVEVfQVBJX1VSTD8udHJpbSgpIHx8CiAgKGlzUHJvZHVjdGlvbiA/ICcvYXBpL3YxJyA6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXBpL3YxJyk7Cgpjb25zdCB3ZWJzb2NrZXRVcmwgPQogIGVudi5WSVRFX1dFQlNPQ0tFVF9VUkw/LnRyaW0oKSB8fAogIChpc1Byb2R1Y3Rpb24KICAgID8gYCR7d2luZG93LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JyA/ICd3c3M6JyA6ICd3czonfS8vJHt3aW5kb3cubG9jYXRpb24uaG9zdH1gCiAgICA6ICd3czovL2xvY2FsaG9zdDozMDAwJyk7CgpleHBvcnQgY29uc3QgQVBJX0NPTkZJRyA9IHsKICBBUElfVVJMOiBhcGlVcmwucmVwbGFjZSgvXC8rJC8sICcnKSwKICBVUExPQURfVVJMOgogICAgZW52LlZJVEVfVVBMT0FEX1VSTD8udHJpbSgpIHx8CiAgICBgJHthcGlVcmwucmVwbGFjZSgvXC8rJC8sICcnKX0vdXBsb2FkYCwKICBXU19VUkw6IHdlYnNvY2tldFVybC5yZXBsYWNlKC9cLyskLywgJycpLAogIC8vIEZha2UgQVBJIMOpIHNvbWVudGUgdW1hIGZlcnJhbWVudGEgZGUgZGVzZW52b2x2aW1lbnRvIGUgZXhpZ2Ugb3B0LWluIGV4cGzDrWNpdG8uCiAgVVNFX0ZBS0VfQVBJOiAhaXNQcm9kdWN0aW9uICYmIGZha2VSZXF1ZXN0ZWQsCiAgVElNRU9VVDogTnVtYmVyKGVudi5WSVRFX0FQSV9USU1FT1VUX01TIHx8IDE1MDAwKSwKICBJU19QUk9EVUNUSU9OOiBpc1Byb2R1Y3Rpb24sCiAgTU9ERTogZW52Lk1PREUsCn0gYXMgY29uc3Q7Cg==", "src/config/features.ts": "aW1wb3J0IHsgQVBJX0NPTkZJRyB9IGZyb20gJy4vYXBpJzsKCmZ1bmN0aW9uIGVudkZsYWcoCiAgbmFtZToKICAgIHwgJ1ZJVEVfRU5BQkxFX1NFTExFUl9QT1JUQUwnCiAgICB8ICdWSVRFX0VOQUJMRV9BRE1JTl9QT1JUQUwnCiAgICB8ICdWSVRFX0VOQUJMRV9FWFBFUklNRU5UQUxfQlVZRVJfRkVBVFVSRVMnLAogIGRldmVsb3BtZW50RGVmYXVsdDogYm9vbGVhbiwKKTogYm9vbGVhbiB7CiAgY29uc3QgcmF3ID0gaW1wb3J0Lm1ldGEuZW52W25hbWVdOwoKICBpZiAocmF3ID09PSAndHJ1ZScpIHJldHVybiB0cnVlOwogIGlmIChyYXcgPT09ICdmYWxzZScpIHJldHVybiBmYWxzZTsKCiAgLy8gRW0gcHJvZHXDp8OjbywgZnVuY2lvbmFsaWRhZGUgbsOjbyBjb21wcm92YWRhbWVudGUgcmVhbCBmaWNhIGZlY2hhZGEuCiAgcmV0dXJuIEFQSV9DT05GSUcuSVNfUFJPRFVDVElPTiA/IGZhbHNlIDogZGV2ZWxvcG1lbnREZWZhdWx0Owp9CgpleHBvcnQgY29uc3QgRlJPTlRFTkRfRkVBVFVSRVMgPSB7CiAgU0VMTEVSX1BPUlRBTDogZW52RmxhZygKICAgICdWSVRFX0VOQUJMRV9TRUxMRVJfUE9SVEFMJywKICAgIHRydWUsCiAgKSwKICBBRE1JTl9QT1JUQUw6IGVudkZsYWcoCiAgICAnVklURV9FTkFCTEVfQURNSU5fUE9SVEFMJywKICAgIHRydWUsCiAgKSwKICBFWFBFUklNRU5UQUxfQlVZRVJfRkVBVFVSRVM6IGVudkZsYWcoCiAgICAnVklURV9FTkFCTEVfRVhQRVJJTUVOVEFMX0JVWUVSX0ZFQVRVUkVTJywKICAgIHRydWUsCiAgKSwKfSBhcyBjb25zdDsK", "src/config/frontendStartup.ts": "aW1wb3J0IHsgQVBJX0NPTkZJRyB9IGZyb20gJy4vYXBpJzsKaW1wb3J0IHsgRlJPTlRFTkRfRkVBVFVSRVMgfSBmcm9tICcuL2ZlYXR1cmVzJzsKCmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRGcm9udGVuZFJ1bnRpbWUoKTogdm9pZCB7CiAgaWYgKEFQSV9DT05GSUcuSVNfUFJPRFVDVElPTiAmJiBBUElfQ09ORklHLlVTRV9GQUtFX0FQSSkgewogICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAnQ29uZmlndXJhw6fDo28gaW5zZWd1cmE6IGZha2UgQVBJIGF0aXZhIGVtIHByb2R1w6fDo28uJywKICAgICk7CiAgfQoKICBpZiAoIUFQSV9DT05GSUcuQVBJX1VSTCkgewogICAgdGhyb3cgbmV3IEVycm9yKCdWSVRFX0FQSV9VUkwvQVBJX1VSTCBuw6NvIGNvbmZpZ3VyYWRhLicpOwogIH0KCiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoQVBJX0NPTkZJRy5USU1FT1VUKSB8fCBBUElfQ09ORklHLlRJTUVPVVQgPD0gMCkgewogICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAnVklURV9BUElfVElNRU9VVF9NUyBkZXZlIHNlciB1bSBuw7ptZXJvIHBvc2l0aXZvLicsCiAgICApOwogIH0KCiAgaWYgKCFBUElfQ09ORklHLklTX1BST0RVQ1RJT04gJiYgQVBJX0NPTkZJRy5VU0VfRkFLRV9BUEkpIHsKICAgIGNvbnNvbGUud2FybigKICAgICAgJ1tNZXJjYWRvIE51c2FsaV0gRmFrZSBBUEkgZXhwbGljaXRhbWVudGUgaGFiaWxpdGFkYSBwYXJhIGRlc2Vudm9sdmltZW50by4nLAogICAgKTsKICB9CgogIGlmIChBUElfQ09ORklHLklTX1BST0RVQ1RJT04pIHsKICAgIGNvbnNvbGUuaW5mbygnW01lcmNhZG8gTnVzYWxpXSBGcm9udGVuZCBpbmljaWFkbyBlbSBtb2RvIGNvbWVyY2lhbC4nLCB7CiAgICAgIGFwaVVybDogQVBJX0NPTkZJRy5BUElfVVJMLAogICAgICBzZWxsZXJQb3J0YWw6IEZST05URU5EX0ZFQVRVUkVTLlNFTExFUl9QT1JUQUwsCiAgICAgIGFkbWluUG9ydGFsOiBGUk9OVEVORF9GRUFUVVJFUy5BRE1JTl9QT1JUQUwsCiAgICAgIGV4cGVyaW1lbnRhbEJ1eWVyRmVhdHVyZXM6CiAgICAgICAgRlJPTlRFTkRfRkVBVFVSRVMuRVhQRVJJTUVOVEFMX0JVWUVSX0ZFQVRVUkVTLAogICAgfSk7CiAgfQp9Cg==", "src/components/FeatureUnavailablePage.tsx": "aW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0JzsKaW1wb3J0IHsgTGluayB9IGZyb20gJ3JlYWN0LXJvdXRlci1kb20nOwoKdHlwZSBQcm9wcyA9IHsKICB0aXRsZTogc3RyaW5nOwogIGRlc2NyaXB0aW9uOiBzdHJpbmc7Cn07CgpleHBvcnQgZnVuY3Rpb24gRmVhdHVyZVVuYXZhaWxhYmxlUGFnZSh7CiAgdGl0bGUsCiAgZGVzY3JpcHRpb24sCn06IFByb3BzKSB7CiAgcmV0dXJuICgKICAgIDxtYWluIGNsYXNzTmFtZT0ibXgtYXV0byBmbGV4IG1pbi1oLVs2MHZoXSBtYXgtdy0yeGwgZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHB4LTYgdGV4dC1jZW50ZXIiPgogICAgICA8aDEgY2xhc3NOYW1lPSJ0ZXh0LTJ4bCBmb250LXNlbWlib2xkIj57dGl0bGV9PC9oMT4KICAgICAgPHAgY2xhc3NOYW1lPSJtdC0zIHRleHQtc20gdGV4dC1ncmF5LTYwMCI+CiAgICAgICAge2Rlc2NyaXB0aW9ufQogICAgICA8L3A+CiAgICAgIDxMaW5rCiAgICAgICAgdG89Ii8iCiAgICAgICAgY2xhc3NOYW1lPSJtdC02IHJvdW5kZWQtbGcgYmctYmxhY2sgcHgtNCBweS0yIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC13aGl0ZSIKICAgICAgPgogICAgICAgIFZvbHRhciBhbyBNZXJjYWRvIE51c2FsaQogICAgICA8L0xpbms+CiAgICA8L21haW4+CiAgKTsKfQo=", "src/vite-env.d.ts": "Ly8vIDxyZWZlcmVuY2UgdHlwZXM9InZpdGUvY2xpZW50IiAvPgoKaW50ZXJmYWNlIEltcG9ydE1ldGFFbnYgewogIHJlYWRvbmx5IFZJVEVfQVBJX1VSTD86IHN0cmluZzsKICByZWFkb25seSBWSVRFX1VQTE9BRF9VUkw/OiBzdHJpbmc7CiAgcmVhZG9ubHkgVklURV9XRUJTT0NLRVRfVVJMPzogc3RyaW5nOwogIHJlYWRvbmx5IFZJVEVfQVBJX1RJTUVPVVRfTVM/OiBzdHJpbmc7CiAgcmVhZG9ubHkgVklURV9VU0VfRkFLRV9BUEk/OiAndHJ1ZScgfCAnZmFsc2UnOwogIHJlYWRvbmx5IFZJVEVfRU5BQkxFX1NFTExFUl9QT1JUQUw/OiAndHJ1ZScgfCAnZmFsc2UnOwogIHJlYWRvbmx5IFZJVEVfRU5BQkxFX0FETUlOX1BPUlRBTD86ICd0cnVlJyB8ICdmYWxzZSc7CiAgcmVhZG9ubHkgVklURV9FTkFCTEVfRVhQRVJJTUVOVEFMX0JVWUVSX0ZFQVRVUkVTPzogJ3RydWUnIHwgJ2ZhbHNlJzsKfQoKaW50ZXJmYWNlIEltcG9ydE1ldGEgewogIHJlYWRvbmx5IGVudjogSW1wb3J0TWV0YUVudjsKfQo=", "tools/check-frontend-production-contract.cjs": "Y29uc3QgZnMgPSByZXF1aXJlKCdmcycpOwpjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpOwoKY29uc3QgUk9PVCA9IHByb2Nlc3MuY3dkKCk7CgpmdW5jdGlvbiByZWFkKHJlbCkgewogIHJldHVybiBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKFJPT1QsIHJlbCksICd1dGY4Jyk7Cn0KCmNvbnN0IGVycm9ycyA9IFtdOwpjb25zdCB3YXJuaW5ncyA9IFtdOwoKY29uc3QgYXBpQ29uZmlnID0gcmVhZCgnc3JjL2NvbmZpZy9hcGkudHMnKTsKY29uc3QgYXBwID0gcmVhZCgnc3JjL0FwcC50c3gnKTsKY29uc3QgbWFpbiA9IHJlYWQoJ3NyYy9tYWluLnRzeCcpOwpjb25zdCBlbnZFeGFtcGxlID0gcmVhZCgnLmVudi5leGFtcGxlJyk7CgppZiAoYXBpQ29uZmlnLmluY2x1ZGVzKCdwcm9jZXNzLmVudi5WSVRFXycpKSB7CiAgZXJyb3JzLnB1c2goCiAgICAnc3JjL2NvbmZpZy9hcGkudHMgYWluZGEgdXNhIHByb2Nlc3MuZW52LlZJVEVfKjsgVml0ZSBkZXZlIHVzYXIgaW1wb3J0Lm1ldGEuZW52LicsCiAgKTsKfQoKaWYgKCFhcGlDb25maWcuaW5jbHVkZXMoImVudi5WSVRFX1VTRV9GQUtFX0FQSSA9PT0gJ3RydWUnIikpIHsKICBlcnJvcnMucHVzaCgKICAgICdGYWtlIEFQSSBuw6NvIGV4aWdlIG9wdC1pbiBleHBsw61jaXRvIFZJVEVfVVNFX0ZBS0VfQVBJPXRydWUuJywKICApOwp9CgppZiAoIWFwaUNvbmZpZy5pbmNsdWRlcygnIWlzUHJvZHVjdGlvbiAmJiBmYWtlUmVxdWVzdGVkJykpIHsKICBlcnJvcnMucHVzaCgKICAgICdGYWtlIEFQSSBuw6NvIGVzdMOhIHRlY25pY2FtZW50ZSBibG9xdWVhZGEgZW0gcHJvZHXDp8Ojby4nLAogICk7Cn0KCmlmICghbWFpbi5pbmNsdWRlcygnYXNzZXJ0RnJvbnRlbmRSdW50aW1lKCknKSkgewogIGVycm9ycy5wdXNoKAogICAgJ0Jvb3RzdHJhcCBkbyBmcm9udGVuZCBuw6NvIGV4ZWN1dGEgYXNzZXJ0RnJvbnRlbmRSdW50aW1lKCkuJywKICApOwp9Cgpmb3IgKGNvbnN0IG1hcmtlciBvZiBbCiAgJ0ZST05URU5EX0ZFQVRVUkVTLlNFTExFUl9QT1JUQUwnLAogICdGUk9OVEVORF9GRUFUVVJFUy5BRE1JTl9QT1JUQUwnLAogICdGUk9OVEVORF9GRUFUVVJFUy5FWFBFUklNRU5UQUxfQlVZRVJfRkVBVFVSRVMnLApdKSB7CiAgaWYgKCFhcHAuaW5jbHVkZXMobWFya2VyKSkgewogICAgZXJyb3JzLnB1c2goYEFwcC50c3ggbsOjbyBhcGxpY2EgbyBnYXRlICR7bWFya2VyfS5gKTsKICB9Cn0KCmlmICghZW52RXhhbXBsZS5pbmNsdWRlcygnVklURV9VU0VfRkFLRV9BUEk9ZmFsc2UnKSkgewogIGVycm9ycy5wdXNoKAogICAgJy5lbnYuZXhhbXBsZSBuw6NvIGRvY3VtZW50YSBWSVRFX1VTRV9GQUtFX0FQST1mYWxzZS4nLAogICk7Cn0KCi8vIEludmVudMOhcmlvIGluZm9ybWF0aXZvOiBtb2NrcyBhaW5kYSBwcmVzZW50ZXMgbm8gc291cmNlLgovLyBOw6NvIGZhbGhhIG5lc3RhIFNwcmludCBwb3JxdWUgYXMgw6FyZWFzIHF1ZSB1c2FtIG1vY2tzIGRpcmV0b3MgZmljYW0gZ2F0ZWFkYXMKLy8gZW0gcHJvZHXDp8OjbyBlIHNlcsOjbyBjb252ZXJ0aWRhcyBuYXMgcHLDs3hpbWFzIHN1Yi1zcHJpbnRzIDguMi54LgpmdW5jdGlvbiB3YWxrKGRpcikgewogIHJldHVybiBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KS5mbGF0TWFwKChlbnRyeSkgPT4gewogICAgY29uc3QgZnVsbCA9IHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpOwogICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHJldHVybiB3YWxrKGZ1bGwpOwogICAgcmV0dXJuIGVudHJ5LmlzRmlsZSgpICYmIC9cLih0c3x0c3gpJC8udGVzdChmdWxsKSA/IFtmdWxsXSA6IFtdOwogIH0pOwp9Cgpjb25zdCBtb2NrSW1wb3J0cyA9IHdhbGsocGF0aC5qb2luKFJPT1QsICdzcmMnKSkKICAuZmxhdE1hcCgoZmlsZSkgPT4gewogICAgY29uc3QgbGluZXMgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZSwgJ3V0ZjgnKS5zcGxpdCgvXHI/XG4vKTsKICAgIHJldHVybiBsaW5lcwogICAgICAubWFwKChsaW5lLCBpKSA9PiAoeyBsaW5lLCBpOiBpICsgMSB9KSkKICAgICAgLmZpbHRlcigoeyBsaW5lIH0pID0+CiAgICAgICAgL2Zyb20gWyciXS4qKD86XC9kYXRhXC9tb2NrfFwvYXBpXC9mYWtlQXBpKS8udGVzdChsaW5lKSwKICAgICAgKQogICAgICAubWFwKCh7IGxpbmUsIGkgfSkgPT4gKHsKICAgICAgICBmaWxlOiBwYXRoLnJlbGF0aXZlKFJPT1QsIGZpbGUpLnJlcGxhY2UoL1xcL2csICcvJyksCiAgICAgICAgbGluZTogaSwKICAgICAgICBpbXBvcnQ6IGxpbmUudHJpbSgpLAogICAgICB9KSk7CiAgfSk7CgppZiAobW9ja0ltcG9ydHMubGVuZ3RoID4gMCkgewogIHdhcm5pbmdzLnB1c2goCiAgICBgJHttb2NrSW1wb3J0cy5sZW5ndGh9IGltcG9ydHMgZGUgbW9jay9mYWtlIGFpbmRhIGV4aXN0ZW0gZSBkZXZlbSBzZXIgcmVtb3ZpZG9zIG5hcyBwcsOzeGltYXMgZXRhcGFzIDguMi54LmAsCiAgKTsKfQoKY29uc29sZS5sb2coJz09PSBNZXJjYWRvIE51c2FsaSBGcm9udGVuZCBQcm9kdWN0aW9uIENvbnRyYWN0ID09PScpOwpjb25zb2xlLmxvZyhgQVBJIGNvbmZpZzogJHtlcnJvcnMubGVuZ3RoID09PSAwID8gJ09LJyA6ICdGQUlMJ31gKTsKY29uc29sZS5sb2coYE1vY2sgaW1wb3J0cyBpbnZlbnRhcmlhZG9zOiAke21vY2tJbXBvcnRzLmxlbmd0aH1gKTsKCmlmIChtb2NrSW1wb3J0cy5sZW5ndGgpIHsKICBjb25zb2xlLmxvZygnXG5QcmltZWlyb3MgaW1wb3J0cyBwZW5kZW50ZXM6Jyk7CiAgZm9yIChjb25zdCBpdGVtIG9mIG1vY2tJbXBvcnRzLnNsaWNlKDAsIDIwKSkgewogICAgY29uc29sZS5sb2coYC0gJHtpdGVtLmZpbGV9OiR7aXRlbS5saW5lfSAke2l0ZW0uaW1wb3J0fWApOwogIH0KfQoKaWYgKHdhcm5pbmdzLmxlbmd0aCkgewogIGNvbnNvbGUubG9nKCdcbldBUk5JTkdTOicpOwogIHdhcm5pbmdzLmZvckVhY2goKHcpID0+IGNvbnNvbGUubG9nKGAtICR7d31gKSk7Cn0KCmlmIChlcnJvcnMubGVuZ3RoKSB7CiAgY29uc29sZS5lcnJvcignXG5FUlJPUzonKTsKICBlcnJvcnMuZm9yRWFjaCgoZSkgPT4gY29uc29sZS5lcnJvcihgLSAke2V9YCkpOwogIHByb2Nlc3MuZXhpdCgxKTsKfQoKY29uc29sZS5sb2coJ1xuQ29udHJhdG8gZGUgcHJvZHXDp8OjbyBkbyBmcm9udGVuZDogUEFTUycpOwo="};

for (const [rel, b64] of Object.entries(payload)) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log('[Sprint 8.2.1]', rel);
}

// main.tsx: fail-fast de configuração.
const mainFile = path.join(ROOT, 'src', 'main.tsx');
let main = fs.readFileSync(mainFile, 'utf8');

if (!main.includes("import {assertFrontendRuntime} from './config/frontendStartup';")) {
  main = main.replace(
    "import './index.css';",
    "import './index.css';\nimport {assertFrontendRuntime} from './config/frontendStartup';",
  );
}

if (!main.includes('assertFrontendRuntime();')) {
  main = main.replace(
    "createRoot(document.getElementById('root')!).render(",
    "assertFrontendRuntime();\n\ncreateRoot(document.getElementById('root')!).render(",
  );
}

fs.writeFileSync(mainFile, main, 'utf8');
console.log('[Sprint 8.2.1] src/main.tsx');

// App.tsx: gates de segurança para áreas ainda não totalmente reais.
const appFile = path.join(ROOT, 'src', 'App.tsx');
let app = fs.readFileSync(appFile, 'utf8');

const featureImport =
  "import { FRONTEND_FEATURES } from './config/features';\n" +
  "import { FeatureUnavailablePage } from './components/FeatureUnavailablePage';";

if (!app.includes("from './config/features'")) {
  app = app.replace(
    "import { AdminDashboardPage } from './pages/AdminDashboardPage';",
    "import { AdminDashboardPage } from './pages/AdminDashboardPage';\n" + featureImport,
  );
}

const experimentalPages = [
  ['favorites', 'FavoritesPage'],
  ['notifications', 'NotificationsPage'],
  ['messages', 'MessagesPage'],
  ['returns-refunds', 'ReturnsRefundsPage'],
  ['disputes', 'DisputesPage'],
];

for (const [route, component] of experimentalPages) {
  const oldLine =
    `<Route path="/${route}" element={<${component} />} />`;
  const newLine =
    `<Route path="/${route}" element={FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES ? <${component} /> : <FeatureUnavailablePage title="Funcionalidade em preparação" description="Esta área será liberada quando estiver totalmente conectada aos serviços reais do Mercado Nusali." />} />`;
  app = app.replace(oldLine, newLine);
}

app = app.replace(
  "<SellerLayout />",
  `{FRONTEND_FEATURES.SELLER_PORTAL ? (
                        <SellerLayout />
                      ) : (
                        <FeatureUnavailablePage
                          title="Portal do vendedor em preparação"
                          description="O portal comercial do vendedor ainda não foi liberado neste ambiente."
                        />
                      )}`,
);

app = app.replace(
  "<AdminLayout />",
  `{FRONTEND_FEATURES.ADMIN_PORTAL ? (
                        <AdminLayout />
                      ) : (
                        <FeatureUnavailablePage
                          title="Administração em preparação"
                          description="O painel administrativo ainda não foi liberado neste ambiente."
                        />
                      )}`,
);

fs.writeFileSync(appFile, app, 'utf8');
console.log('[Sprint 8.2.1] src/App.tsx');

// .env.example: frontend contract documentado.
const envFile = path.join(ROOT, '.env.example');
let env = fs.readFileSync(envFile, 'utf8');

if (!env.includes('# Frontend (Vite)')) {
  env += `

# Frontend (Vite)
# Em desenvolvimento, use a API Nest local:
VITE_API_URL=http://localhost:3000/api/v1
VITE_UPLOAD_URL=http://localhost:3000/api/v1/upload
VITE_WEBSOCKET_URL=ws://localhost:3000
VITE_API_TIMEOUT_MS=15000

# IMPORTANTE: fake API é opt-in e nunca é permitida em production.
VITE_USE_FAKE_API=false

# Enquanto os portais não forem 100% convertidos para API real,
# mantenha-os false no build comercial.
VITE_ENABLE_SELLER_PORTAL=false
VITE_ENABLE_ADMIN_PORTAL=false
VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES=false
`;
}

fs.writeFileSync(envFile, env, 'utf8');
console.log('[Sprint 8.2.1] .env.example');

// package.json: checker reproduzível.
const packageFile = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts['check:frontend:production'] =
  'node tools/check-frontend-production-contract.cjs';
fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('[Sprint 8.2.1] package.json');

console.log('');
console.log('[Sprint 8.2.1] aplicação concluída.');
console.log('[Sprint 8.2.1] Fake API agora é opt-in em desenvolvimento e proibida em produção.');
console.log('[Sprint 8.2.1] Seller/Admin/Buyer experimental ficam fechados por padrão no build comercial.');
console.log('[Sprint 8.2.1] Nenhuma migration necessária.');
