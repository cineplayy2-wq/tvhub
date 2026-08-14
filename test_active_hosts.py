import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

new_ip = "169.58.179.6"
ssh_key_path = os.path.expanduser("~/.ssh/tvhub_vps")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(new_ip, username="root", key_filename=ssh_key_path, timeout=15)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    return out

pg_id = run("docker ps -q -f name=tvhub_postgres")
print("ACTIVE CHANNELS BY HOST:")
print(run(f'docker exec {pg_id} psql -U tvhub -d tvhub -c "SELECT substring(\\"streamUrl\\" from \'^https?://([^/]+)\') AS host, \\"isActive\\", count(*) FROM \\"M3uChannel\\" GROUP BY host, \\"isActive\\";"'))

ssh.close()
