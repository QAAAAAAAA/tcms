
### Make some improvments:

#### v1.2

- support Google Auth

#### v1.1

- support report Jira Bug form`

#### v1.0

- Create Jira Bug tickets under **SPDE** with att:

  - Reporter by login user(default: sunh@sea.com),
  - Reproducibility(default: Always),
  - Server Environment(default: Testing),
  - Severity(default: Major),
  - Bug Type(default: UI),
  - Lables(default: data_tracking)

- Add Bug status in front of bug link in TestRun
- Defect default value to True when add hyperlink

### setup your local env

```shell
python -m venv .kiwi
source .kiwi/bin/activate
pip install -r requirements/mariadb.txt -r requirements/devel.txt
cd tcms/
npm install
./manage.py migrate
./manage.py createsuperuser
./manage.py runserver
# open http://127.0.0.1:8000/ to access tcms
```

---

### issues

- Failed to build cryptography

  ```shell
  brew install openssl
  env LDFLAGS="-L$(brew --prefix openssl)/lib" CFLAGS="-I$(brew --prefix openssl)/include" pip install cryptography
  ```

- WARNING: could not open statistics file "pg_stat_tmp/global.stat": Operation not permitted

  ````shell
  docker exec -it <imagename/uuid> /bin/bash
  rm -rf /var/lib/postgresql/data/pg_stat_tmp/global.stat```
  ````

- WARNING: could not open file "global/pg_filenode.map": Permission denied

  ```shell
  docker stop $container
  ```

- Error: AttributeError: 'EntryPoints' object has no attribute 'get'

```shell
pip install importlib-metadata==4.13.0
```
