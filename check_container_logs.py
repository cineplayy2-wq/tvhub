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

# Get container ID for running app
container_id = run("docker ps -q -f name=tvhub_app")
print(f"Container ID: {container_id}")
if container_id:
    print(run(f"docker logs {container_id} --tail 100"))

ssh.close()
