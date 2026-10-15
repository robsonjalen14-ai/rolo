const groups = [require('./admin'), require('./downloads'), require('./keyauthCommands'), require('./staff'), require('./misc')];

const map = new Map();
for (const group of groups) {
  for (const cmd of group) map.set(cmd.data.name, cmd);
}

module.exports = {
  get: (name) => map.get(name),
  array: () => [...map.values()].map((c) => c.data),
  map,
};