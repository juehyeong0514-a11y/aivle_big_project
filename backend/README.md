# Backend

개발용 REST API 서버입니다. 별도 데이터베이스를 설치하지 않아도 실행되며, 처음 시작할 때 `data/database.json`을 만들어 계정과 화면용 데이터를 저장합니다.

```bash
cd backend
npm install
npm run dev
```

기본 계정은 다음과 같고 비밀번호는 모두 `123`입니다.

- `applicant@aivle.com`
- `supervisor@aivle.com`
- `admin@aivle.com`

API는 `http://localhost:3000/api`에서 실행됩니다. 테스트는 `npm test`로 실행합니다.
