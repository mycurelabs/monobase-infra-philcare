{{/*
Volume backup method for velero Schedules. Default "csi" = native CSI snapshots
(requires a VolumeSnapshotLocation). "fsb" = File System Backup (kopia -> object
store via node-agent) for setups WITHOUT a VSL — e.g. Azure storage-account-key
auth (see backup-locations.yaml), where CSI snapshotVolumes would silently skip
PVC data. Emits the snapshotVolumes/defaultVolumesToFsBackup pair, plus (fsb)
orderedResources for consistent ordering. snapshotMoveData (CSI-only) stays an
explicit per-schedule line, rendered only under csi.
*/}}
{{- define "velero-resources.volumeBackup" -}}
{{- if eq (.Values.velero.backupMethod | default "csi") "fsb" -}}
snapshotVolumes: false
defaultVolumesToFsBackup: true
orderedResources:
  - namespaces
  - persistentvolumes
  - persistentvolumeclaims
  - secrets
  - configmaps
  - serviceaccounts
  - services
  - deployments.apps
  - statefulsets.apps
  - daemonsets.apps
  - jobs.batch
  - cronjobs.batch
{{- else -}}
snapshotVolumes: true
defaultVolumesToFsBackup: false
{{- end -}}
{{- end }}
