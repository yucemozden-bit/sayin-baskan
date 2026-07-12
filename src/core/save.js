export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse save data', error);
    return null;
  }
}
