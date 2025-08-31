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
{{- .Release.Namespace -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
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
================================================================================
REFACTOR: Generic component helpers (Corrected Version)
================================================================================
*/}}

{{/*
Generic component fullname (e.g., "lingua-quiz-backend")
*/}}
{{- define "lingua-quiz-app.component.fullname" -}}
{{- printf "%s-%s" (include "lingua-quiz-app.fullname" .root) .component.name -}}
{{- end -}}

{{/*
Generic component selector labels
CORRECTED: Simplified to use the full component name for the 'name' label.
This prevents templating issues and creates cleaner, more standard labels.
*/}}
{{- define "lingua-quiz-app.component.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lingua-quiz-app.component.fullname" . }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component.name }}
{{- end -}}

{{/*
Generic component labels
*/}}
{{- define "lingua-quiz-app.component.labels" -}}
{{ include "lingua-quiz-app.labels" .root }}
{{ include "lingua-quiz-app.component.selectorLabels" . }}
{{- end -}}

{{/*
Generic component template for Deployment and Service
*/}}
{{- define "lingua-quiz-app.component.tpl" -}}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "lingua-quiz-app.component.fullname" . }}
  namespace: {{ include "lingua-quiz-app.namespace" .root }}
  labels:
    {{- include "lingua-quiz-app.component.labels" . | nindent 4 }}
spec:
  replicas: {{ .component.values.replicaCount | default .root.Values.replicaCount }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  progressDeadlineSeconds: 600
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      {{- include "lingua-quiz-app.component.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "lingua-quiz-app.component.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .root.Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- if .root.Values.serviceAccount.create }}
      serviceAccountName: {{ include "lingua-quiz-app.serviceAccountName" .root }}
      {{- end }}
      terminationGracePeriodSeconds: 30
      securityContext:
        {{- toYaml .root.Values.podSecurityContext | default "{}" | nindent 8 }}
      containers:
        - name: {{ .component.name }}
          securityContext:
            {{- toYaml .root.Values.securityContext | default "{}" | nindent 12 }}
          image: "{{ .component.values.image.repository }}:{{ .component.values.image.tag | default .root.Chart.AppVersion }}"
          imagePullPolicy: {{ .component.values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .component.values.port }}
              protocol: TCP
          {{- if .component.values.probes }}
          livenessProbe:
            httpGet:
              path: {{ .component.values.probes.liveness.path }}
              port: http
              scheme: HTTP
            initialDelaySeconds: {{ .component.values.probes.liveness.initialDelaySeconds }}
            periodSeconds: {{ .component.values.probes.liveness.periodSeconds }}
            timeoutSeconds: {{ .component.values.probes.liveness.timeoutSeconds }}
            failureThreshold: {{ .component.values.probes.liveness.failureThreshold }}
          readinessProbe:
            httpGet:
              path: {{ .component.values.probes.readiness.path }}
              port: http
              scheme: HTTP
            initialDelaySeconds: {{ .component.values.probes.readiness.initialDelaySeconds }}
            periodSeconds: {{ .component.values.probes.readiness.periodSeconds }}
            timeoutSeconds: {{ .component.values.probes.readiness.timeoutSeconds }}
            successThreshold: {{ .component.values.probes.readiness.successThreshold }}
            failureThreshold: {{ .component.values.probes.readiness.failureThreshold }}
          {{- if .component.values.probes.startup }}
          startupProbe:
            httpGet:
              path: {{ .component.values.probes.startup.path }}
              port: http
              scheme: HTTP
            failureThreshold: {{ .component.values.probes.startup.failureThreshold }}
            periodSeconds: {{ .component.values.probes.startup.periodSeconds }}
            timeoutSeconds: {{ .component.values.probes.startup.timeoutSeconds }}
          {{- end }}
          {{- end }}
          resources:
            {{- toYaml .component.values.resources | nindent 12 }}
          {{- if eq .component.name "backend" }}
          env:
            - name: PORT
              value: {{ .component.values.port | quote }}
            - name: DB_HOST
              value: {{ .root.Values.postgres.external.host | quote }}
            - name: DB_PORT
              value: {{ .root.Values.postgres.external.port | default "5432" | quote }}
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: {{ include "lingua-quiz-app.fullname" .root }}-postgres
                  key: POSTGRES_DB
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: {{ include "lingua-quiz-app.fullname" .root }}-postgres
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "lingua-quiz-app.fullname" .root }}-postgres
                  key: POSTGRES_PASSWORD
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "lingua-quiz-app.fullname" .root }}-jwt
                  key: JWT_SECRET
            - name: CORS_ALLOWED_ORIGINS
              value: {{ .component.values.corsAllowedOrigins | quote }}
            {{- if .root.Values.secrets.googleCloudCredentialsB64 }}
            - name: GOOGLE_CLOUD_CREDENTIALS_B64
              valueFrom:
                secretKeyRef:
                  name: {{ include "lingua-quiz-app.fullname" .root }}-tts
                  key: GOOGLE_CLOUD_CREDENTIALS_B64
            {{- end }}
          {{- end }}
          {{- if eq .component.name "frontend" }}
          volumeMounts:
            - name: cache-volume
              mountPath: /var/cache/nginx
            - name: run-volume
              mountPath: /var/run
          {{- end }}
      volumes:
        {{- if eq .component.name "frontend" }}
        - name: cache-volume
          emptyDir: {}
        - name: run-volume
          emptyDir: {}
        {{- end }}
      {{- with .root.Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .root.Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .root.Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ include "lingua-quiz-app.component.fullname" . }}
  namespace: {{ include "lingua-quiz-app.namespace" .root }}
  labels:
    {{- include "lingua-quiz-app.component.labels" . | nindent 4 }}
spec:
  type: {{ .component.values.service.type }}
  ports:
    - port: {{ .component.values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
      {{- if and (eq .component.values.service.type "NodePort") .component.values.service.nodePort }}
      nodePort: {{ .component.values.service.nodePort }}
      {{- end }}
  selector:
    {{- include "lingua-quiz-app.component.selectorLabels" . | nindent 4 }}
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

{{/*
PostgreSQL Fullname (used for service and statefulset name)
*/}}
{{- define "lingua-quiz-app.postgresql.fullname" -}}
{{- printf "%s-postgres" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
