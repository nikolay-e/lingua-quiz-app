{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "lingua-quiz-backup.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Get the namespace name
*/}}
{{- define "lingua-quiz-backup.namespace" -}}
{{- default "lingua-quiz-production" .Values.namespace -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "lingua-quiz-backup.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "lingua-quiz-backup.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "lingua-quiz-backup.labels" -}}
helm.sh/chart: {{ include "lingua-quiz-backup.chart" . }}
{{ include "lingua-quiz-backup.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels - Adjust if needed for backup job selection
*/}}
{{- define "lingua-quiz-backup.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lingua-quiz-backup.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}