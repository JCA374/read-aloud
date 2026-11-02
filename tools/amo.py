#!/usr/bin/env python3
"""Small addons.mozilla.org API helper, using the keys in the environment (see tools/sign.sh).

  python3 tools/amo.py latest   <add-on id>             newest version number, any channel
  python3 tools/amo.py versions <add-on id>             every version: number, channel, status
  python3 tools/amo.py download <add-on id> <version>   saves dist/neural-voices-<version>-signed.xpi

Run with the keys loaded:  set -a; . ./.amo-keys; set +a; python3 tools/amo.py versions <id>
"""
import base64, hashlib, hmac, json, os, sys, time, urllib.request, uuid

API = "https://addons.mozilla.org/api/v5/addons/addon/"


def token():
    key, secret = os.environ.get("WEB_EXT_API_KEY"), os.environ.get("WEB_EXT_API_SECRET")
    if not key or not secret:
        sys.exit("WEB_EXT_API_KEY / WEB_EXT_API_SECRET not set (load .amo-keys first)")
    b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
    now = int(time.time())
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps({"iss": key, "jti": str(uuid.uuid4()), "iat": now, "exp": now + 60}).encode())
    sig = b64(hmac.new(secret.encode(), head + b"." + body, hashlib.sha256).digest())
    return (head + b"." + body + b"." + sig).decode()


def get(url, raw=False):
    req = urllib.request.Request(url, headers={"Authorization": "JWT " + token()})
    with urllib.request.urlopen(req) as res:
        return res.read() if raw else json.load(res)


def versions(addon):
    return get(f"{API}{addon}/versions/?filter=all_with_unlisted")["results"]  # newest first


def main(cmd, addon, *rest):
    if cmd == "latest":
        found = versions(addon)
        print(found[0]["version"] if found else "0")
    elif cmd == "versions":
        for v in versions(addon):
            print(v["version"], v["channel"], v["file"]["status"])
    elif cmd == "download":
        v = next(v for v in versions(addon) if v["version"] == rest[0])
        out = f"dist/neural-voices-{rest[0]}-signed.xpi"
        data = get(v["file"]["url"], raw=True)
        want = v["file"]["hash"].split(":", 1)[1]
        if hashlib.sha256(data).hexdigest() != want:
            sys.exit("downloaded file doesn't match Mozilla's checksum")
        open(out, "wb").write(data)
        print(out, want)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(*sys.argv[1:]) if len(sys.argv) >= 3 else sys.exit(__doc__)
