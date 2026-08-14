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

# 1. Update dead channels to isActive = false
print("DEACTIVATING DEAD HOSTS...")
print(run(f'docker exec {pg_id} psql -U tvhub -d tvhub -c "UPDATE \\"M3uChannel\\" SET \\"isActive\\" = false WHERE \\"streamUrl\\" LIKE \'%power032183.shop%\' OR \\"streamUrl\\" LIKE \'%power76920.shop%\';"'))

# 2. Update M3uPlaylist
print("\nUPDATING PLAYLIST WITH ACTIVE PROVIDER...")
print(run(f'docker exec {pg_id} psql -U tvhub -d tvhub -c "UPDATE \\"M3uPlaylist\\" SET \\"sourceUrl\\" = \'http://cdtune.site/get.php?username=417367&password=679834&type=m3u_plus&output=mpegts\', \\"xtreamUsername\\" = \'417367\', \\"xtreamPassword\\" = \'679834\' WHERE \\"isSystem\\" = true;"'))

# 3. Update Users with active credentials
print("\nUPDATING USERS WITH ACTIVE IPTV CREDENTIALS...")
print(run(f'docker exec {pg_id} psql -U tvhub -d tvhub -c "UPDATE \\"User\\" SET \\"iptvUsername\\" = \'417367\', \\"iptvPassword\\" = \'679834\';"'))

# 4. Verify Active Channels
print("\nACTIVE CHANNELS NOW:")
print(run(f'docker exec {pg_id} psql -U tvhub -d tvhub -c "SELECT substring(\\"streamUrl\\" from \'^https?://([^/]+)\') AS host, \\"isActive\\", count(*) FROM \\"M3uChannel\\" GROUP BY host, \\"isActive\\";"'))

ssh.close()
