const upper = 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs';
const trunk = 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax';
const lower = 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs';
export const muscleGuide = {
  Chest: {
    subtitle: 'The muscles behind pressing and bringing the arms together.',
    paragraphs: ['The pectoralis major spans the front of the chest and helps move the upper arm forward and across the body. It works alongside other shoulder muscles rather than moving the arm alone.', 'Labels such as Upper Chest and Lower Chest describe the areas emphasized in your collection. They remain part of the same Chest group.'],
    source: upper,
  },
  Back: {
    subtitle: 'A network for moving the arms, shoulder blades, and trunk.',
    paragraphs: ['The back contains several muscle groups with different jobs. The lats move the upper arms, while the trapezius and rhomboids help position the shoulder blades.', 'Your collection brings Lats, Mid Back, Traps, and Spine together under Back. The spine-related muscles help extend and stabilize the trunk.'],
    source: upper, extraSource: trunk,
  },
  Arms: {
    subtitle: 'Elbow movement, forearm rotation, and grip.',
    paragraphs: ['The biceps and brachialis bend the elbow; the triceps straighten it. Forearm muscles also move the wrist and fingers, supporting the grip used to hold equipment.', 'Biceps, Triceps, Forearms, and Brachioradialis are the focus areas used in this collection.'],
    source: upper,
  },
  Legs: {
    subtitle: 'The muscles that move the hips, knees, and ankles.',
    paragraphs: ['The quadriceps straighten the knee, while the hamstrings bend it and help extend the hip. The gluteal muscles move the thigh at the hip; the calf muscles help point the foot downward.', 'This collection groups Glutes, Quads, Hamstrings, and Calves under Legs. Each area contributes a different part of lower-body movement.'],
    source: lower,
  },
  Core: {
    subtitle: 'More than abs: movement and support around the trunk.',
    paragraphs: ['The abdominal wall includes the rectus abdominis, internal and external obliques, and transversus abdominis. Together with other trunk muscles, these muscles help bend, rotate, and stabilize the torso.', 'Upper Abs and Lower Abs are regional labels used in your collection, rather than separate abdominal muscles. Obliques describe the muscles along the sides of the abdomen.'],
    source: trunk,
  },
  Shoulders: {
    subtitle: 'Moving the upper arm in several directions.',
    paragraphs: ['The deltoid has front, middle, and rear portions that help move the arm forward, out to the side, and backward. Other muscles around the shoulder also contribute to its movement and stability.', 'Your collection calls these areas Front Delts, Side Delts, and Rear Delts.'],
    source: upper,
  },
};
export function muscleDescription(group) {
  return muscleGuide[group.name] || { subtitle: 'Explore this muscle group.', paragraphs: [`This group includes ${(group.muscles || []).join(', ') || group.name}. Explore its focus areas and the matching movements in your collection.`] };
}
