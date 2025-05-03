{{/* NOTE: Removed the first comment block entirely */}}
{{- define "lingua-quiz.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{/* Keep function name generic for wider use */}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "lingua-quiz.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{/* Keep function name generic */}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "lingua-quiz.chart" -}} {{-/* Keep function name generic */-}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/ -}} {{- /* Removed trailing brace/comment space */}}
{{- define "lingua-quiz.labels" -}} {{-/* Keep function name generic */-}} {{/* Removed leading hyphen from define */}}
helm.sh/chart: {{ include "lingua-quiz.chart" . }}
{{ include "lingua-quiz.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels for the backend deployment/service
*/ -}} {{- /* Removed trailing brace/comment space */}}
{{- define "lingua-quiz.selectorLabels" -}} {{-/* Keep function name generic */-}} {{/* Removed leading hyphen from define */}}
app.kubernetes.io/name: {{ include "lingua-quiz.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Create the name of the service account to use
*/ -}} {{- /* Removed trailing brace/comment space */}}
{{- define "lingua-quiz.serviceAccountName" -}} {{-/* Keep function name generic */-}} {{/* Removed leading hyphen from define */}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "lingua-quiz.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
PostgreSQL Fullname (used for service and statefulset name)
*/ -}} {{- /* Removed trailing brace/comment space */}}
{{- define "lingua-quiz.postgresql.fullname" -}} {{-/* Keep function name generic */-}} {{/* Removed leading hyphen from define */}}
{{- printf "%s-%s" .Release.Name "postgres" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
PostgreSQL Selector labels (used for selecting postgres pods)
*/ -}} {{- /* Removed trailing brace/comment space */}}
{{- define "lingua-quiz.postgresql.selectorLabels" -}} {{-/* Keep function name generic */-}} {{/* Removed leading hyphen from define */}}
app.kubernetes.io/name: postgres
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}