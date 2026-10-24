# Exercise catalog

Seed files define one movement with supported equipment names:

```js
{
  name: 'Bench Press',
  muscleGroupId: 1,
  equipmentOptions: ['Smith Machine'],
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Triceps', 'Front Delts'],
}
```

MongoDB's `exercises` collection stores one document per movement. Each
`equipmentOptions` entry contains a stable `key`, `equipmentId`, muscle details,
isolation flag, and default `attachmentId`. IDs reference shared code arrays in
catalog.js, attachments.js, and muscle-groups.js; these lists have no active MongoDB
collections. The API resolves their labels and expands these options for browsing; workout
saves validate the exercise ID and option key and store the chosen option as a
snapshot, so later catalog edits do not rewrite workout history.

Edit existing movements and options directly in MongoDB. Startup inserts new
seed movements but preserves edits to existing documents. Changing an existing
seed's options does not overwrite the saved options; edit the corresponding
MongoDB document too. Retain a unique option key within each exercise. Flat,
incline, seated, and other materially different movements remain distinct.

Equipment reference arrays store categories and labels, not a duplicate database exercise list.
The equipment page derives associated exercises from `equipmentOptions`.
Individual machine records are unnecessary until you track a specific gym's
inventory, settings, maintenance, or availability.

Legacy per-muscle exercise collections remain as migration references. They
are imported once and are no longer the active catalog. Saved workouts retain
their historical snapshots. Migration markers live in `migrations`.

Never reuse or change reference IDs. Add new entries with new IDs, and retain
old IDs while stored exercises or workouts reference them. Attachment selections
are validated against the equipment's allowed attachment ID list. Edit the code
arrays to change reference labels; edit MongoDB exercise options to change which
references a movement uses. Retired collection backups live in api/backups.
