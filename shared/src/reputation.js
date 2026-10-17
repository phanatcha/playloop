export const REPUTATION_POINTS = {
  helpfulVote: 10,
  notHelpfulVote: -3,
  feedbackPlanned: 5,
  feedbackFixed: 15,
};

export const LEVELS = [
  { level: 1, title: 'Rookie', minPoints: 0 },
  { level: 2, title: 'Tester', minPoints: 100 },
  { level: 3, title: 'Playtester', minPoints: 300 },
  { level: 4, title: 'Critic', minPoints: 700 },
  { level: 5, title: 'Senior Critic', minPoints: 1500 },
  { level: 6, title: 'Expert', minPoints: 3000 },
  { level: 7, title: 'Master Reviewer', minPoints: 5000 },
  { level: 8, title: 'Legend', minPoints: 8000 },
];

export const BADGES = [
  {
    key: 'first_launch',
    name: 'First Launch',
    description: 'Published your first game',
    kind: 'achievement',
    threshold: 1,
  },
  {
    key: 'first_review',
    name: 'First Review',
    description: 'Submitted your first review',
    kind: 'achievement',
    threshold: 1,
  },
  {
    key: 'thoughtful_critic',
    name: 'Thoughtful Critic',
    description: 'Submitted 10 reviews',
    kind: 'achievement',
    threshold: 10,
  },
  {
    key: 'helping_hand',
    name: 'Helping Hand',
    description: 'Received 50 helpful votes',
    kind: 'achievement',
    threshold: 50,
  },
  {
    key: 'bug_hunter',
    name: 'Bug Hunter',
    description: '5 of your reviews were marked Fixed',
    kind: 'achievement',
    threshold: 5,
  },
  {
    key: 'roulette_regular',
    name: 'Roulette Regular',
    description: 'Submitted 5 reviews from Playtest Roulette',
    kind: 'achievement',
    threshold: 5,
  },
  {
    key: 'reviewer_of_the_month',
    name: 'Reviewer of the Month',
    description: 'Earned the most reputation points in a month',
    kind: 'ranking',
  },
  {
    key: 'hall_of_fame',
    name: 'Hall of Fame',
    description: 'In the top 10 reviewers of all time',
    kind: 'ranking',
    threshold: 10,
  },
];
