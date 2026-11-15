# 도형 디펜스

도형으로 막는 무한 디펜스 게임입니다. 폰 세로 화면용이며, 파일 하나로 동작합니다.

- 플레이: GitHub Pages 주소를 폰 브라우저로 열고 "홈 화면에 추가"를 누르면 앱처럼 실행됩니다.
- `index.html` 게임 본체, `manifest.webmanifest`와 아이콘은 홈 화면 추가용, `sw.js`는 오프라인 실행용입니다.

## 개발
- 소스는 `src/`, 빌드는 `python3 build.py` (루트의 `index.html` 등을 다시 만듭니다. Pillow 필요).
- 밸런스 도구는 `tools/`, 설계 문서는 `docs/`, 작업 규칙과 남은 일은 `CLAUDE.md`에 있습니다.
