import {
    fetchPosts,
    fetchContent,
    fetchComments,
    createComment,
    deleteComment,
    patchComment
} from '../services/posts';
import pathToRegExp from 'path-to-regexp';
import {message} from 'antd';

export default {
    namespace: 'posts',
    state: {
        postsList: [],
        paging: {},
        postsById: {},
        current: {
            post: {
                post_id: null,
                author: null,
                title: null,
                visible: null,
                created_at: null,
                descendants: [],
                content: null
            },
            isEditing: false
        }
    },
    subscriptions: {
        setup: function ({history, dispatch}) {
            history.listen(location => {
                if (['/posts'].includes(location.pathname)) {
                    dispatch({
                        type: 'fetchPostsList',
                        payload: {
                            pageInfo: {
                                limit: 5,
                                page: 1
                            }
                        }
                    });
                }

                const match = pathToRegExp('/posts/:post_id').exec(location.pathname);
                if (match) {
                    const post_id = match[1];
                    dispatch({
                        type: 'displayPost',
                        payload: {post_id}
                    });
                }
            });
        }
    },
    effects: {
        fetchPostsList: function *({payload}, {call, put}) {
            const {pageInfo} = payload;
            const {data:list} = yield call(fetchPosts, {pageInfo});

            if (list) {
                yield put({
                    type: 'savePostsList',
                    payload: list
                });
            }
        },
        displayPost: function*({payload}, {put}) {
            yield put({
                type: 'clearCurrentPostInfo'
            });
            const {post_id} = payload;
            yield put({
                type: 'saveCurrentPostInfo',
                payload: {post_id}
            });

            yield [
                put({type: 'fetchPostContent'}),
                put({type: 'fetchPostComments'})
            ];

        },
        fetchPostContent: function*({payload}, {call, put, select}) {
            const post_id = yield select(state => state.posts.current.post.post_id);
            const {data} = yield call(fetchContent, {post_id});

            if (data) {
                const {content} = data;
                yield put({
                    type: 'savePostContent',
                    payload: {content}
                });
            }
        },
        fetchPostComments: function*({payload}, {call, put, select}) {
            const post_id = yield select(state => state.posts.current.post.post_id);
            const {data} = yield call(fetchComments, {post_id});
            if (data) {
                const {descendants} = data;
                yield put({
                    type: 'saveComments',
                    payload: {descendants}
                });
            }
        },
        createNewComment: function*({payload}, {call, put, select}) {
            const post_id = yield select(state => state.posts.current.post_id);
            const {commentInput} = payload;
            const {data:newComment} = yield call(createComment, {commentInput, post_id});
            if (newComment) {
                yield put({
                    type: 'pushNewComment',
                    payload: {newComment, post_id}
                });
                message.success('create comment successfully. :)');
            }
        },
        deleteComment: function*({payload}, {call, put, select}) {
            const ascendant = yield select(state => state.posts.current.post_id);
            const {comment_id} = payload;
            yield call(deleteComment, {comment_id});
            yield put({
                type: 'removeComment',
                payload: {comment_id, ascendant}
            });
            message.success('Delete comment successfully. :)');
        },
        patchComment: function *({payload}, {call, put, select}) {
            const {comment_id, editorContent} = payload;
            const {data} = yield call(patchComment, {comment_id, editorContent});
            if (data) {
                yield put({type: 'saveUpdatedComment', payload: {updatedComment: data}});
                message.success('Update comment successfully. :)');
            }
        }
    },
    reducers: {
        savePostsList: function (state, {payload}) {
            const {paging, data:list} = payload;

            const posts = list.reduce((memo, post) => {
                memo[post.post_id] = post;
                return memo;
            }, {});

            return {
                ...state,
                paging,
                postsList: list,
                postsById: {...state.postsById, ...posts}
            };
        },
        clearCurrentPostInfo: function (state, {payload}) {
            return {
                ...state,
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        post_id: null,
                        author: null,
                        title: null,
                        visible: null,
                        created_at: null,
                        descendants: [],
                        content: null
                    },
                    isEditing: false
                }
            };
        },
        saveCurrentPostInfo: function (state, {payload}) {
            const {post_id} = payload;
            return {
                ...state,
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        ...state.postsById[post_id]
                    }
                }
            };
        },
        savePostContent: function (state, {payload}) {
            const {content} = payload;
            return {
                ...state,
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        content
                    }
                }
            };
        },
        saveComments: function (state, {payload}) {
            const {descendants} = payload;
            return {
                ...state,
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        descendants
                    }
                }
            };
        },
        pushNewComment: function (state, {payload}) {
            const {newComment, post_id} = payload;
            const currentPost = state.postsById[post_id];
            return {
                ...state,
                postsById: {
                    ...state.postsById,
                    [post_id]: {
                        ...currentPost,
                        descendants: [...currentPost.descendants, newComment.comment_id]
                    }
                },
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        descendants: [...state.current.post.descendants, newComment]
                    }
                }
            };
        },
        removeComment: function (state, {payload}) {
            const {comment_id, ascendant} = payload;
            const currentPost = state.postsById[ascendant];
            return {
                ...state,
                postsById: {
                    ...state.postsById,
                    [ascendant]: {
                        ...currentPost,
                        descendants: currentPost.descendants.filter(comment => comment !== comment_id)
                    }
                },
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        descendants: state.current.post.descendants.filter(comment => comment.comment_id !== comment_id)
                    }
                }
            };
        },
        showEditor: function (state) {
            return {
                ...state,
                current: {
                    ...state.current,
                    isEditing: true
                }
            };
        },
        closeEditor: function (state) {
            return {
                ...state,
                current: {
                    ...state.current,
                    isEditing: false
                }
            };
        },
        saveUpdatedComment: function (state, {payload}) {
            const {updatedComment} = payload;
            return {
                ...state,
                current: {
                    ...state.current,
                    post: {
                        ...state.current.post,
                        descendants: state.current.post.descendants.map(comment => {
                            if (comment.comment_id === updatedComment.comment_id) {
                                return updatedComment;
                            }
                            return comment;
                        })
                    },
                    isEditing: false
                }
            }
        }
    }
}
