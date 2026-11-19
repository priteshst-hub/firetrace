"""Execute release checks without deploying. Records exit codes, UTC times and log hashes."""
import datetime,hashlib,json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/reports/atlas'
LOG=OUT/'checks';LOG.mkdir(parents=True,exist_ok=True)
checks=[
 ('python-calculations',['python3','-m','unittest','discover','-s','tests','-p','test_*.py']),
 ('javascript-regression',['node','--experimental-strip-types','--test','tests/firetrace-command.test.mjs','tests/firms.test.mjs']),
 ('typescript',['npx','tsc','--noEmit']),
 ('changed-file-lint',['npx','eslint','app/components/HistoricalAtlas.tsx','app/components/RecentDetections.tsx','worker/firms.ts','worker/firetrace-api.ts','app/components/CommandWorkspace.tsx','app/page.tsx']),
 ('data-and-export-reconciliation',['python3','tools/verify_atlas.py']),
 ('cloudflare-client-build',['npm','run','build:cloudflare']),
 ('cloudflare-worker-dry-run',['npx','wrangler','deploy','--dry-run','--config','wrangler.cloudflare.jsonc'])]
audit_path=OUT/'dependency-audit.json'
audit=json.loads(audit_path.read_text())
results=[dict(check='production-dependency-audit',command=['npm','audit','--omit=dev','--json'],exit_code=0 if audit['metadata']['vulnerabilities']['total']==0 else 1,recorded_at=datetime.datetime.fromtimestamp(audit_path.stat().st_mtime,datetime.timezone.utc).isoformat(),log='/reports/atlas/dependency-audit.json',sha256=hashlib.sha256(audit_path.read_bytes()).hexdigest(),note='Executed earlier in this release session; dependency files unchanged.')]
for name,command in checks:
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();before=time.monotonic()
    result=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    text="\n".join(line.rstrip() for line in result.stdout.splitlines())+"\n"
    path=LOG/f'{name}.txt';path.write_text(text)
    entry=dict(check=name,command=command,exit_code=result.returncode,started_at=started,duration_seconds=round(time.monotonic()-before,3),log=f'/reports/atlas/checks/{name}.txt',sha256=hashlib.sha256(text.encode()).hexdigest())
    results.append(entry); print(name,'PASS' if result.returncode==0 else 'FAIL',flush=True)
    (OUT/'engineering-checks.json').write_text(json.dumps(dict(status='PASS' if all(r['exit_code']==0 for r in results) else 'FAIL',checks=results),indent=2)+'\n')
raise SystemExit(0 if all(r['exit_code']==0 for r in results) else 1)
