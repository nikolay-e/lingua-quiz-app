{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "lingua-quiz-app.name" -}}
{{- default "lingua-quiz" .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Get the namespace name
*/}}
{{- define "lingua-quiz-app.namespace" -}}
{{- default "lingua-quiz-production" .Values.namespace -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
Always use the release name directly to avoid appending chart name.
*/}}
{{- define "lingua-quiz-app.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "lingua-quiz-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "lingua-quiz-app.labels" -}}
helm.sh/chart: {{ include "lingua-quiz-app.chart" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{/*
Backend specific labels
*/}}
{{- define "lingua-quiz-app.backend.labels" -}}
{{ include "lingua-quiz-app.labels" . }}
app.kubernetes.io/name: {{ include "lingua-quiz-app.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end -}}

{{/*
Backend selector labels
*/}}
{{- define "lingua-quiz-app.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lingua-quiz-app.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end -}}

{{/*
Frontend specific labels
*/}}
{{- define "lingua-quiz-app.frontend.labels" -}}
{{ include "lingua-quiz-app.labels" . }}
app.kubernetes.io/name: {{ include "lingua-quiz-app.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end -}}

{{/*
Frontend selector labels
*/}}
{{- define "lingua-quiz-app.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lingua-quiz-app.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end -}}

{{/*
Backend fullname
*/}}
{{- define "lingua-quiz-app.backend.fullname" -}}
{{- printf "%s-backend" (include "lingua-quiz-app.fullname" .) -}}
{{- end -}}

{{/*
Frontend fullname
*/}}
{{- define "lingua-quiz-app.frontend.fullname" -}}
{{- printf "%s-frontend" (include "lingua-quiz-app.fullname" .) -}}
{{- end -}}

{{/*
PostgreSQL Fullname (used for service and statefulset name)
*/}}
{{- define "lingua-quiz-app.postgresql.fullname" -}}
{{- printf "%s-postgres" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
PostgreSQL Selector labels
*/}}
{{- define "lingua-quiz-app.postgresql.selectorLabels" -}}
app.kubernetes.io/name: postgres
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "lingua-quiz-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
    {{ default (include "lingua-quiz-app.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
    {{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}