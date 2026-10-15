import {Component, type ReactNode} from 'react';
import {isChunkError, reloadForUpdate} from '../lib/update';

interface State {
  error: unknown;
  /** Reloading onto the new version right now. */
  reloading: boolean;
}

/**
 * A message instead of a blank page when part of the site fails to load or show. After an update it reloads onto the
 * new version by itself; otherwise it offers a reload.
 */
export default class ErrorBoundary extends Component<{children: ReactNode; resetKey?: string}, State> {
  state: State = {error: null, reloading: false};

  static getDerivedStateFromError(error: unknown) {
    return {error};
  }

  componentDidCatch(error: unknown) {
    if (isChunkError(error)) this.setState({reloading: reloadForUpdate()});
  }

  // Going to another page clears the message.
  componentDidUpdate(prev: {resetKey?: string}) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({error: null, reloading: false});
  }

  render() {
    const {error, reloading} = this.state;
    if (!error) return this.props.children;
    const [title, text] = reloading
      ? ['Сайт шинэчлэгдсэн байна', 'Шинэ хувилбарыг ачаалж байна…']
      : !navigator.onLine
        ? ['Интернэт холболт алга', 'Холбогдоод дахин ачаална уу.']
        : isChunkError(error)
          ? ['Хуудсыг ачаалж чадсангүй', 'Дахин ачаалаад үзнэ үү.']
          : ['Алдаа гарлаа', 'Хуудсыг дахин ачаалаад үзнэ үү.'];
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-neutral-400">{text}</p>
        {!reloading && (
          <button onClick={() => location.reload()} className="mt-5 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400">
            Дахин ачаалах
          </button>
        )}
      </div>
    );
  }
}
