# LinguaQuiz - Copyright © 2025 Nikolay Eremeev
#
# Dual-licensed:
#  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
#  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
#
# Contact: lingua-quiz@nikolay-eremeev.com
# Repository: https://github.com/nikolay-e/lingua-quiz
# File: packages/backend/docker/backup/Dockerfile

FROM postgres:13-alpine

RUN apk add --no-cache ca-certificates curl

RUN curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc

RUN mc --version

RUN mkdir /backup && chown postgres:postgres /backup

USER postgres
