#!/usr/bin/env python3
"""Small addons.mozilla.org API helper, using the keys in the environment (see tools/sign.sh).

  python3 tools/amo.py latest   <add-on id>             newest version number, any channel
  python3 tools/amo.py versions <add-on id>             every version: number, channel, status
  python3 tools/amo.py download <add-on id> <version>   saves dist/neural-voices-<version>-signed.xpi
  python3 tools/amo.py listing  <add-on id> [--dry-run] sends the store texts in docs/listing/listing.json
  python3 tools/amo.py previews <add-on id> <png>...    uploads screenshots (in this order)
  python3 tools/amo.py icon     <add-on id>             uploads extension/icons/icon128.png as the store icon
  python3 tools/amo.py status   <add-on id>             the add-on's store status and each version's review

Run with the keys loaded:  set -a; . ./.amo-keys; set +a; python3 tools/amo.py versions <id>
"""
import base64, hashlib, hmac, json, os, sys, time, urllib.error, urllib.request, uuid

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


def send(method, url, body, content_type="application/json"):
    req = urllib.request.Request(url, data=body, method=method, headers={"Authorization": "JWT " + token(), "Content-Type": content_type})
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url}: {e.code} {e.read().decode()[:500]}")


def multipart(fields, files):
    """fields: {name: value}; files: {name: (filename, bytes, type)} -> (body, content type)"""
    b = uuid.uuid4().hex
    out = b""
    for k, v in fields.items():
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (name, data, typ) in files.items():
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {typ}\r\n\r\n'.encode() + data + b"\r\n"
    return out + f"--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


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
    elif cmd == "listing":
        meta = json.load(open("docs/listing/listing.json"))
        meta.pop("license")  # set on the version (tools/sign.sh --listed)
        if "--dry-run" in rest:
            print(json.dumps(meta, indent=1, ensure_ascii=False)[:3000])
            return
        r = send("PATCH", f"{API}{addon}/", json.dumps(meta).encode())
        print("listing saved:", r["name"], "|", r["summary"], "|", r["categories"], "|", r["url"])
    elif cmd == "previews":
        for pos, path in enumerate(rest):
            if pos:
                time.sleep(45)  # Mozilla allows about one upload a minute
            body, typ = multipart({"position": pos}, {"image": (os.path.basename(path), open(path, "rb").read(), "image/png")})
            r = send("POST", f"{API}{addon}/previews/", body, typ)
            print("uploaded", path, "->", r.get("image_url", r))
    elif cmd == "icon":  # the store doesn't take the icon from the add-on: it's uploaded separately
        body, typ = multipart({}, {"icon": ("icon128.png", open("extension/icons/icon128.png", "rb").read(), "image/png")})
        r = send("PATCH", f"{API}{addon}/", body, typ)
        print("store icon:", r.get("icons", r))
    elif cmd == "status":
        a = get(f"{API}{addon}/")
        print("add-on:", a["status"], "| listed:", a.get("current_version", {}) and a["current_version"].get("version"), "|", a["url"])
        for v in versions(addon)[:6]:
            print(" ", v["version"], v["channel"], v["file"]["status"])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(*sys.argv[1:]) if len(sys.argv) >= 3 else sys.exit(__doc__)
