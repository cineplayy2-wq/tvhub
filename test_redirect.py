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
    print(f"\n[RUN] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    if out:
        print("STDOUT:\n" + out)
    return out

# 1. Follow redirect for TS live stream
print("TESTING TS STREAM WITH -L (FOLLOW REDIRECT):")
run('curl -s -D - -o /dev/null -m 8 -L -A "VLC/3.0.18 LibVLC/3.0.18" "http://hghg.mr34567.site:80/417367/679834/418388.ts"')

# 2. Follow redirect for Series MP4
print("\nTESTING SERIES MP4 WITH -L (FOLLOW REDIRECT):")
run('curl -s -D - -o /dev/null -m 8 -L -A "VLC/3.0.18 LibVLC/3.0.18" "http://hghg.mr34567.site:80/series/417367/679834/1329915.mp4"')

ssh.close()
