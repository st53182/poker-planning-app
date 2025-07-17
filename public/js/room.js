class PlanningPokerRoom {
    constructor() {
        this.socket = io();
        this.roomData = {};
        this.participant = {};
        this.participants = [];
        this.stories = [];
        this.currentStory = null;
        this.selectedVote = null;
        this.isAdmin = false;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.joinRoom();
    }

    initializeEventListeners() {
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const baseUrl = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(baseUrl).then(() => {
                this.showToast('Ссылка на комнату скопирована!', 'success');
            }).catch(() => {
                this.showToast(`Поделитесь этой ссылкой: ${baseUrl}`, 'info');
            });
        });

        document.getElementById('createStoryBtn').addEventListener('click', () => {
            this.createStory();
        });

        document.getElementById('openImageUploadModal').addEventListener('click', () => {
            this.openImageUploadModal();
        });

        document.getElementById('openTextUploadModal').addEventListener('click', () => {
            this.openTextUploadModal();
        });

        document.getElementById('createStoriesFromImageBtn').addEventListener('click', () => {
            this.createStoriesFromImage();
        });

        document.getElementById('createStoriesFromTextBtn').addEventListener('click', () => {
            this.createStoriesFromText();
        });

        document.getElementById('cancelImageUploadBtn').addEventListener('click', () => {
            this.closeImageUploadModal();
        });

        document.getElementById('cancelTextUploadBtn').addEventListener('click', () => {
            this.closeTextUploadModal();
        });

        document.getElementById('storyFilter').addEventListener('change', (e) => {
            this.filterStories(e.target.value);
        });

        document.getElementById('saveStoryBtn').addEventListener('click', () => {
            this.saveStoryEdit();
        });

        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.cancelStoryEdit();
        });

        document.getElementById('startVotingBtn').addEventListener('click', () => {
            this.startVoting();
        });

        document.getElementById('revealVotesBtn').addEventListener('click', () => {
            this.revealVotes();
        });

        document.getElementById('finalizeBtn').addEventListener('click', () => {
            this.finalizeEstimate();
        });

        document.getElementById('voteAgainBtn').addEventListener('click', () => {
            this.startVoting();
        });

        document.getElementById('submitVoteBtn').addEventListener('click', () => {
            this.submitVote();
        });


        document.getElementById('dismissError').addEventListener('click', () => {
            document.getElementById('errorToast').classList.add('hidden');
        });

        document.getElementById('newStoryTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createStory();
        });
        
        const claimBtn = document.getElementById('claimRoomBtn');
        if (claimBtn) {
            claimBtn.addEventListener('click', () => {
                this.claimRoom();
            });
        }

        const deleteBtn = document.getElementById('deleteRoomBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteRoom();
            });
        }
    }

    initializeSocketListeners() {
        this.socket.on('room_joined', (data) => {
            this.handleRoomJoined(data);
        });

        this.socket.on('participant_joined', (data) => {
            this.participants.push(data.participant);
            this.updateParticipantsList();
        });

        this.socket.on('story_created', (data) => {
            this.stories.unshift(data.story);
            this.updateStoriesList();
        });

        this.socket.on('bulk_stories_created', (data) => {
            data.stories.forEach(story => {
                this.stories.unshift(story);
            });
            this.updateStoriesList();
        });

        this.socket.on('story_updated', (data) => {
            const storyIndex = this.stories.findIndex(s => s.id === data.story.id);
            if (storyIndex !== -1) {
                this.stories[storyIndex] = data.story;
                this.updateStoriesList();
            }
        });

        this.socket.on('story_deleted', (data) => {
            this.stories = this.stories.filter(s => s.id !== data.story_id);
            this.updateStoriesList();
        });

        this.socket.on('stories_reordered', (data) => {
            this.updateLocalStoryOrder(data.story_orders);
            this.updateStoriesList();
        });

        this.socket.on('current_story_set', (data) => {
            this.currentStory = this.stories.find(story => story.id === data.story_id);
            this.updateCurrentStory();
            this.resetVotingState();
        });

        this.socket.on('voting_started', (data) => {
            if (this.currentStory && this.currentStory.id === data.story_id) {
                this.currentStory.voting_state = 'voting';
                this.updateVotingState();
                this.resetVotingState();
            }
        });

        this.socket.on('vote_submitted', (data) => {
            document.getElementById('voteCount').textContent = data.vote_count;
            document.getElementById('participantCount').textContent = data.participant_count;
        });

        this.socket.on('votes_revealed', (data) => {
            if (this.currentStory && this.currentStory.id === data.story_id) {
                this.currentStory.voting_state = 'revealed';
                this.updateVotingState();
                this.displayRevealedVotes(data.votes);
            }
        });

        this.socket.on('estimate_finalized', (data) => {
            if (this.currentStory && this.currentStory.id === data.story_id) {
                this.currentStory.voting_state = 'completed';
                this.currentStory.final_estimate = data.final_estimate;
                this.updateVotingState();
                this.updateStoriesList();
            }
        });

        this.socket.on('similar_stories', (data) => {
            this.displaySimilarStories(data.stories);
        });

        this.socket.on('admin_promoted', (data) => {
            const participantIndex = this.participants.findIndex(p => p.id === data.participant.id);
            if (participantIndex !== -1) {
                this.participants[participantIndex] = data.participant;
                this.updateParticipantsList();
            }
        });

        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    joinRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const pathParts = window.location.pathname.split('/');
        const encryptedLink = pathParts[pathParts.length - 1];
        
        let name = urlParams.get('name');
        let competence = urlParams.get('competence');
        
        const authToken = localStorage.getItem('auth_token');
        const userInfo = localStorage.getItem('user_info');
        
        if (authToken && userInfo && !name && !competence) {
            const user = JSON.parse(userInfo);
            name = user.name;
            competence = 'Fullstack'; // Default competence for authenticated users
            document.getElementById('joinModal').classList.add('hidden');
            this.performJoin(encryptedLink, name, competence);
            return;
        }
        
        const storedName = localStorage.getItem('participant_name');
        const storedCompetence = localStorage.getItem('participant_competence');
        const sessionId = localStorage.getItem('session_id');
        
        const isCreator = sessionId && urlParams.has('name') && urlParams.has('competence');
        const hasStoredSession = storedName && storedCompetence && sessionId;
        
        if (!isCreator && !name && !competence && hasStoredSession) {
            name = storedName;
            competence = storedCompetence;
            document.getElementById('joinModal').classList.add('hidden');
            this.performJoin(encryptedLink, name, competence);
        } else if (!isCreator || !name || !competence) {
            document.getElementById('joinName').value = storedName || '';
            document.getElementById('joinCompetence').value = storedCompetence || 'Frontend';
            document.getElementById('joinModal').classList.remove('hidden');
            
            document.getElementById('joinRoomBtn').onclick = () => {
                name = document.getElementById('joinName').value.trim();
                competence = document.getElementById('joinCompetence').value;
                
                if (!name) {
                    this.showError('Пожалуйста, введите ваше имя');
                    return;
                }
                
                localStorage.setItem('participant_name', name);
                localStorage.setItem('participant_competence', competence);
                
                document.getElementById('joinModal').classList.add('hidden');
                this.performJoin(encryptedLink, name, competence);
            };
        } else {
            document.getElementById('joinModal').classList.add('hidden');
            this.performJoin(encryptedLink, name, competence);
        }
    }

    performJoin(encryptedLink, name, competence) {
        const sessionId = localStorage.getItem('session_id') || this.generateSessionId();
        const authToken = localStorage.getItem('auth_token');
        
        this.socket.emit('join_room_by_link', {
            encrypted_link: encryptedLink,
            name: name,
            competence: competence,
            session_id: sessionId,
            auth_token: authToken
        });
    }

    generateSessionId() {
        const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('session_id', sessionId);
        return sessionId;
    }

    handleRoomJoined(data) {
        this.roomData = data;
        this.participant = data.participant;
        this.participants = data.participants;
        this.stories = data.stories;
        this.currentStory = data.current_story;
        this.isAdmin = data.participant.is_admin;

        document.getElementById('roomName').textContent = data.room_name || 'Комната Планирования';
        document.getElementById('estimationType').textContent = `Тип оценки: ${data.estimation_type === 'story_points' ? 'Стори поинты' : 'Часы'}`;
        document.getElementById('userName').textContent = data.participant.name;
        document.getElementById('userCompetence').textContent = data.participant.competence;
        
        if (this.isAdmin) {
            document.getElementById('adminBadge').classList.remove('hidden');
            document.getElementById('adminControls').classList.remove('hidden');
        }

        this.updateParticipantsList();
        this.updateStoriesList();
        this.updateCurrentStory();
        this.generateVotingCards();
        this.checkAuthenticationStatus();
        
        setTimeout(() => {
            this.updateStoriesList();
        }, 100);
    }

    generateVotingCards() {
        const votingCards = document.getElementById('votingCards');
        const values = this.roomData.estimation_type === 'story_points' 
            ? [0.5, 1, 2, 3, 5, 8, 13, 21, 34]
            : [1, 2, 4, 8, 16, 24, 32, 40, 48, 56, 64];

        votingCards.innerHTML = '';
        
        values.forEach(value => {
            const card = document.createElement('div');
            card.className = 'voting-card bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors';
            card.innerHTML = `<div class="text-lg font-bold">${value}</div>`;
            
            card.addEventListener('click', () => {
                this.selectVote(value);
            });
            
            votingCards.appendChild(card);
        });
    }

    selectVote(value) {
        this.selectedVote = value;
        
        document.querySelectorAll('.voting-card').forEach(card => {
            card.classList.remove('selected', 'border-blue-500', 'bg-blue-50');
            card.classList.add('border-gray-200');
        });
        
        event.target.closest('.voting-card').classList.add('selected', 'border-blue-500', 'bg-blue-50');
        event.target.closest('.voting-card').classList.remove('border-gray-200');
        
        document.getElementById('selectedVoteValue').textContent = value;
        document.getElementById('submitVoteBtn').classList.remove('hidden');
        
        this.socket.emit('get_similar_stories', {
            room_id: this.roomData.room_id,
            vote_value: value,
            competence: this.participant.competence
        });
    }

    createStory() {
        const title = document.getElementById('newStoryTitle').value.trim();
        const description = document.getElementById('newStoryDescription').value.trim();
        
        if (!title) {
            this.showError('Пожалуйста, введите название истории');
            return;
        }
        
        this.socket.emit('create_story', {
            room_id: this.roomData.room_id,
            title: title,
            description: description,
            participant_id: this.participant.id
        });
        
        document.getElementById('newStoryTitle').value = '';
        document.getElementById('newStoryDescription').value = '';
    }

    setCurrentStory(storyId) {
        if (!this.isAdmin) return;
        
        this.socket.emit('set_current_story', {
            room_id: this.roomData.room_id,
            story_id: storyId,
            participant_id: this.participant.id
        });
    }

    startVoting() {
        this.socket.emit('start_voting', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            participant_id: this.participant.id
        });
    }

    submitVote() {
        if (this.selectedVote === null) return;
        
        this.socket.emit('submit_vote', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            points: this.selectedVote,
            participant_id: this.participant.id
        });
        
        document.getElementById('submitVoteBtn').classList.add('hidden');
        this.showToast('Голос отправлен!', 'success');
    }

    revealVotes() {
        this.socket.emit('reveal_votes', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            participant_id: this.participant.id
        });
    }

    finalizeEstimate() {
        const finalEstimate = parseFloat(document.getElementById('finalEstimateInput').value);
        
        if (!finalEstimate) {
            this.showError('Пожалуйста, введите финальную оценку');
            return;
        }
        
        this.socket.emit('finalize_estimate', {
            room_id: this.roomData.room_id,
            story_id: this.currentStory.id,
            final_estimate: finalEstimate,
            participant_id: this.participant.id
        });
        
        document.getElementById('finalEstimateInput').value = '';
    }

    makeAdmin(participantId) {
        this.socket.emit('make_admin', {
            room_id: this.roomData.room_id,
            target_participant_id: participantId,
            participant_id: this.participant.id
        });
    }

    async claimRoom() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            this.showError('Необходимо войти в систему для присвоения комнаты');
            return;
        }
        
        if (!this.roomData || !this.roomData.room_id) {
            this.showError('Данные комнаты не загружены. Попробуйте обновить страницу.');
            return;
        }
        
        try {
            const response = await fetch('/api/claim-room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    room_id: this.roomData.room_id
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.message, 'success');
                document.getElementById('claimRoomBtn').classList.add('hidden');
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Ошибка при присвоении комнаты: ' + error.message);
        }
    }

    async deleteRoom() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            this.showError('Необходимо войти в систему для удаления комнаты');
            return;
        }
        
        if (!confirm('Вы уверены, что хотите удалить эту комнату? Это действие нельзя отменить.')) {
            return;
        }
        
        try {
            const response = await fetch('/api/delete-room', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    room_id: this.roomData.room_id
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.message, 'success');
                window.location.href = '/dashboard.html';
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Ошибка при удалении комнаты: ' + error.message);
        }
    }

    updateCurrentStory() {
        const section = document.getElementById('currentStorySection');
        
        if (!this.currentStory) {
            section.classList.add('hidden');
            return;
        }
        
        section.classList.remove('hidden');
        document.getElementById('currentStoryTitle').textContent = this.currentStory.title;
        
        const descElement = document.getElementById('currentStoryDescription');
        if (this.currentStory.description) {
            descElement.textContent = this.currentStory.description;
            descElement.classList.remove('hidden');
        } else {
            descElement.classList.add('hidden');
        }
        
        this.updateVotingState();
    }

    updateVotingState() {
        if (!this.currentStory) return;
        
        const state = this.currentStory.voting_state;
        const badge = document.getElementById('votingStateBadge');
        const votingSection = document.getElementById('votingSection');
        const revealedSection = document.getElementById('revealedVotesSection');
        const startBtn = document.getElementById('startVotingBtn');
        const revealBtn = document.getElementById('revealVotesBtn');
        const finalizeControls = document.getElementById('finalizeControls');
        
        const stateLabels = {
            'not_started': 'Не начато',
            'voting': 'Голосование',
            'revealed': 'Показано',
            'completed': 'Завершено'
        };
        
        const stateClasses = {
            'not_started': 'bg-gray-100 text-gray-800',
            'voting': 'bg-blue-100 text-blue-800',
            'revealed': 'bg-green-100 text-green-800',
            'completed': 'bg-purple-100 text-purple-800'
        };
        
        badge.textContent = stateLabels[state] || state;
        badge.className = `px-3 py-1 rounded-full text-sm font-medium ${stateClasses[state]}`;
        
        if (this.isAdmin) {
            startBtn.classList.toggle('hidden', state !== 'not_started');
            revealBtn.classList.toggle('hidden', state !== 'voting');
            finalizeControls.classList.toggle('hidden', state !== 'revealed');
        }
        
        votingSection.classList.toggle('hidden', state !== 'voting');
        revealedSection.classList.toggle('hidden', state !== 'revealed');
    }

    resetVotingState() {
        this.selectedVote = null;
        document.getElementById('submitVoteBtn').classList.add('hidden');
        document.getElementById('similarStoriesSection').classList.add('hidden');
        
        document.querySelectorAll('.voting-card').forEach(card => {
            card.classList.remove('selected', 'border-blue-500', 'bg-blue-50');
            card.classList.add('border-gray-200');
        });
    }

    displayRevealedVotes(votes) {
        const container = document.getElementById('revealedVotes');
        container.innerHTML = '';
        
        votes.forEach(vote => {
            const voteElement = document.createElement('div');
            voteElement.className = 'bg-green-50 border border-green-200 rounded-lg p-4 text-center';
            voteElement.innerHTML = `
                <div class="text-lg font-bold">${vote.points}</div>
                <div class="text-sm text-gray-600">${vote.participant_name}</div>
                <div class="text-xs text-gray-500">${vote.competence}</div>
            `;
            container.appendChild(voteElement);
        });
    }

    displaySimilarStories(stories) {
        const section = document.getElementById('similarStoriesSection');
        const list = document.getElementById('similarStoriesList');
        const valueSpan = document.getElementById('similarVoteValue');
        const typeSpan = document.getElementById('similarEstimationType');
        
        if (stories.length === 0) {
            section.classList.add('hidden');
            return;
        }
        
        valueSpan.textContent = this.selectedVote;
        typeSpan.textContent = this.roomData.estimation_type === 'story_points' ? 'поинтов' : 'часов';
        
        list.innerHTML = '';
        stories.slice(0, 5).forEach(story => {
            const storyElement = document.createElement('div');
            storyElement.className = 'text-sm text-blue-800';
            storyElement.textContent = `"${story.title}" - ${story.points} ${this.roomData.estimation_type === 'story_points' ? 'поинтов' : 'часов'}`;
            list.appendChild(storyElement);
        });
        
        section.classList.remove('hidden');
    }

    updateParticipantsList() {
        const container = document.getElementById('participantsList');
        const count = document.getElementById('participantsCount');
        
        count.textContent = this.participants.length;
        
        if (this.participants.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Пока нет участников.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        this.participants.forEach(participant => {
            const participantElement = document.createElement('div');
            participantElement.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
            
            const adminBadge = participant.is_admin 
                ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Админ</span>'
                : '';
            
            const makeAdminBtn = this.isAdmin && !participant.is_admin && participant.id !== this.participant.id
                ? `<button onclick="room.makeAdmin('${participant.id}')" class="text-xs text-blue-600 hover:text-blue-800">Сделать админом</button>`
                : '';
            
            participantElement.innerHTML = `
                <div>
                    <div class="font-medium text-gray-900">${participant.name}</div>
                    <div class="text-sm text-gray-600">${participant.competence}</div>
                </div>
                <div class="flex items-center space-x-2">
                    ${adminBadge}
                    ${makeAdminBtn}
                </div>
            `;
            
            container.appendChild(participantElement);
        });
    }

    updateStoriesList() {
        const container = document.getElementById('storiesList');
        const filterValue = document.getElementById('storyFilter').value;
        
        let displayStories = this.stories;
        if (filterValue !== 'all') {
            if (filterValue === 'unestimated') {
                displayStories = this.stories.filter(s => !s.final_estimate);
            } else {
                displayStories = this.stories.filter(s => s.final_estimate == filterValue);
            }
        }
        
        if (displayStories.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Нет историй для отображения.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        displayStories.forEach((story, index) => {
            const storyElement = document.createElement('div');
            const isCurrentStory = this.currentStory && story.id === this.currentStory.id;
            
            storyElement.draggable = this.isAdmin;
            storyElement.dataset.storyId = story.id;
            storyElement.dataset.orderPosition = story.order_position || index;
            
            const clickableClass = this.isAdmin ? 'cursor-pointer hover:bg-gray-50 hover:border-blue-300' : '';
            const clickHint = this.isAdmin && !isCurrentStory ? 'border-l-4 border-l-blue-400' : '';
            
            storyElement.className = `p-4 border rounded-lg transition-colors ${clickableClass} ${clickHint} ${
                isCurrentStory ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`;
            
            if (this.isAdmin) {
                storyElement.addEventListener('dragstart', this.handleDragStart.bind(this));
                storyElement.addEventListener('dragover', this.handleDragOver.bind(this));
                storyElement.addEventListener('drop', this.handleDrop.bind(this));
                storyElement.addEventListener('click', (e) => {
                    if (!e.target.closest('button')) {
                        this.setCurrentStory(story.id);
                    }
                });
                storyElement.title = 'Нажмите, чтобы начать оценку этой истории';
            }
            
            const finalEstimateBadge = story.final_estimate 
                ? `<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">${story.final_estimate} ${this.roomData.estimation_type === 'story_points' ? 'поинтов' : 'часов'}</span>`
                : '';
            
            const stateClasses = {
                'not_started': 'bg-gray-100 text-gray-800',
                'voting': 'bg-blue-100 text-blue-800',
                'revealed': 'bg-green-100 text-green-800',
                'completed': 'bg-purple-100 text-purple-800'
            };
            
            const stateLabels = {
                'not_started': 'Не начато',
                'voting': 'Голосование',
                'revealed': 'Показано',
                'completed': 'Завершено'
            };
            
            const clickHintText = this.isAdmin && !isCurrentStory ? 
                '<div class="text-xs text-blue-600 mt-1">👆 Нажмите для начала оценки</div>' : '';
            
            const actionButtons = this.isAdmin ? `
                <div class="flex space-x-2 mt-2">
                    <button onclick="room.editStory('${story.id}')" class="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Редактировать</button>
                    <button onclick="room.deleteStory('${story.id}')" class="text-xs text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded">Удалить</button>
                </div>
            ` : '';
            
            storyElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${story.title}</h4>
                        ${story.description ? `<p class="text-sm text-gray-600 mt-1">${story.description}</p>` : ''}
                        ${clickHintText}
                        ${actionButtons}
                    </div>
                    <div class="flex items-center space-x-2 ml-4">
                        ${finalEstimateBadge}
                        <span class="px-2 py-1 rounded text-xs ${stateClasses[story.voting_state] || 'bg-gray-100 text-gray-800'}">
                            ${stateLabels[story.voting_state] || story.voting_state}
                        </span>
                    </div>
                </div>
            `;
            
            container.appendChild(storyElement);
        });
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorToast').classList.remove('hidden');
        
        setTimeout(() => {
            document.getElementById('errorToast').classList.add('hidden');
        }, 5000);
    }

    checkAuthenticationStatus() {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('user_info');
        
        if (token && user) {
            document.getElementById('dashboardBtn').classList.remove('hidden');
            const authLinks = document.getElementById('authLinks');
            if (authLinks) {
                authLinks.classList.add('hidden');
            }
            
            if (this.isAdmin && this.roomData && !this.roomData.owner_id) {
                const claimBtn = document.getElementById('claimRoomBtn');
                if (claimBtn) {
                    claimBtn.classList.remove('hidden');
                }
            } else {
                const claimBtn = document.getElementById('claimRoomBtn');
                if (claimBtn) {
                    claimBtn.classList.add('hidden');
                }
            }

            if (this.isAdmin) {
                const deleteBtn = document.getElementById('deleteRoomBtn');
                if (deleteBtn) {
                    deleteBtn.classList.remove('hidden');
                }
            } else {
                const deleteBtn = document.getElementById('deleteRoomBtn');
                if (deleteBtn) {
                    deleteBtn.classList.add('hidden');
                }
            }
        } else {
            document.getElementById('dashboardBtn').classList.add('hidden');
            const authLinks = document.getElementById('authLinks');
            if (authLinks) {
                authLinks.classList.remove('hidden');
                
                const currentUrl = encodeURIComponent(window.location.href);
                const loginLink = document.getElementById('loginLink');
                const registerLink = document.getElementById('registerLink');
                
                if (loginLink) {
                    loginLink.href = `/login?redirect=${currentUrl}`;
                }
                if (registerLink) {
                    registerLink.href = `/register?redirect=${currentUrl}`;
                }
            }
            const claimBtn = document.getElementById('claimRoomBtn');
            if (claimBtn) {
                claimBtn.classList.add('hidden');
            }
        }
        
        if (this.isAdmin && this.stories && this.stories.length > 0) {
            const adminHint = document.getElementById('adminHint');
            if (adminHint) {
                adminHint.classList.remove('hidden');
            }
        }
    }

    openImageUploadModal() {
        document.getElementById('imageUploadModal').classList.remove('hidden');
    }

    closeImageUploadModal() {
        document.getElementById('imageUploadModal').classList.add('hidden');
        document.getElementById('bulkImageUpload').value = '';
    }

    openTextUploadModal() {
        document.getElementById('textUploadModal').classList.remove('hidden');
    }

    closeTextUploadModal() {
        document.getElementById('textUploadModal').classList.add('hidden');
        document.getElementById('bulkTextInput').value = '';
    }

    async createStoriesFromImage() {
        const fileInput = document.getElementById('bulkImageUpload');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showError('Пожалуйста, выберите изображение');
            return;
        }

        const button = document.getElementById('createStoriesFromImageBtn');
        button.disabled = true;
        button.textContent = 'Обработка...';

        const formData = new FormData();
        formData.append('image', file);
        formData.append('room_id', this.roomData.room_id);
        formData.append('participant_id', this.participant.id);

        try {
            const response = await fetch('/api/bulk-create-stories-image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                this.showToast(`Создано ${result.stories.length} историй из изображения`, 'success');
                this.closeImageUploadModal();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Ошибка при создании историй: ' + error.message);
        } finally {
            button.disabled = false;
            button.textContent = 'Создать истории';
        }
    }

    async createStoriesFromText() {
        const text = document.getElementById('bulkTextInput').value.trim();
        
        if (!text) {
            this.showError('Пожалуйста, введите текст');
            return;
        }

        const button = document.getElementById('createStoriesFromTextBtn');
        button.disabled = true;
        button.textContent = 'Обработка...';

        try {
            const response = await fetch('/api/bulk-create-stories-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_id: this.roomData.room_id,
                    participant_id: this.participant.id,
                    text: text
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showToast(`Создано ${result.stories.length} историй из текста`, 'success');
                this.closeTextUploadModal();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            this.showError('Ошибка при создании историй: ' + error.message);
        } finally {
            button.disabled = false;
            button.textContent = 'Создать истории';
        }
    }

    filterStories(filterValue) {
        const filteredStories = filterValue === 'all' ? this.stories :
            filterValue === 'unestimated' ? this.stories.filter(s => !s.final_estimate) :
            this.stories.filter(s => s.final_estimate == filterValue);
        
        this.displayFilteredStories(filteredStories);
    }

    displayFilteredStories(stories) {
        const container = document.getElementById('storiesList');
        
        if (stories.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Нет историй, соответствующих фильтру.</p>';
            return;
        }
        
        container.innerHTML = '';
        
        stories.forEach((story, index) => {
            const storyElement = document.createElement('div');
            storyElement.draggable = this.isAdmin;
            storyElement.dataset.storyId = story.id;
            storyElement.dataset.orderPosition = story.order_position || index;
            
            if (this.isAdmin) {
                storyElement.addEventListener('dragstart', this.handleDragStart.bind(this));
                storyElement.addEventListener('dragover', this.handleDragOver.bind(this));
                storyElement.addEventListener('drop', this.handleDrop.bind(this));
            }
            
            const isCurrentStory = this.currentStory && this.currentStory.id === story.id;
            storyElement.className = `p-4 border rounded-lg cursor-pointer transition-colors ${
                isCurrentStory ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`;
            
            if (this.isAdmin) {
                storyElement.addEventListener('click', () => this.setCurrentStory(story));
            }
            
            const finalEstimateBadge = story.final_estimate 
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">${story.final_estimate} SP</span>`
                : '';
            
            const stateClasses = {
                'not_started': 'bg-gray-100 text-gray-800',
                'voting': 'bg-yellow-100 text-yellow-800',
                'revealed': 'bg-blue-100 text-blue-800',
                'finalized': 'bg-green-100 text-green-800'
            };
            
            const stateLabels = {
                'not_started': 'Не начата',
                'voting': 'Голосование',
                'revealed': 'Голоса открыты',
                'finalized': 'Завершена'
            };
            
            const clickHintText = this.isAdmin && !isCurrentStory ? ' (нажмите для выбора)' : '';
            const actionButtons = this.isAdmin ? `
                <div class="flex space-x-2 mt-2">
                    <button onclick="room.editStory('${story.id}')" class="text-xs text-blue-600 hover:text-blue-800">Редактировать</button>
                    <button onclick="room.deleteStory('${story.id}')" class="text-xs text-red-600 hover:text-red-800">Удалить</button>
                </div>
            ` : '';
            
            storyElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${story.title}${clickHintText}</h4>
                        ${story.description ? `<p class="text-sm text-gray-600 mt-1">${story.description}</p>` : ''}
                        ${actionButtons}
                    </div>
                    <div class="flex flex-col items-end space-y-2">
                        ${finalEstimateBadge}
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stateClasses[story.voting_state] || stateClasses['not_started']}">
                            ${stateLabels[story.voting_state] || stateLabels['not_started']}
                        </span>
                    </div>
                </div>
            `;
            
            container.appendChild(storyElement);
        });
    }

    editStory(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        if (!story) return;

        this.editingStoryId = storyId;
        document.getElementById('editStoryTitle').value = story.title;
        document.getElementById('editStoryDescription').value = story.description || '';
        document.getElementById('editStoryModal').classList.remove('hidden');
    }

    saveStoryEdit() {
        const title = document.getElementById('editStoryTitle').value.trim();
        const description = document.getElementById('editStoryDescription').value.trim();

        if (!title) {
            this.showError('Пожалуйста, введите название истории');
            return;
        }

        this.socket.emit('update_story', {
            story_id: this.editingStoryId,
            title: title,
            description: description,
            room_id: this.roomData.room_id
        });

        this.cancelStoryEdit();
    }

    cancelStoryEdit() {
        document.getElementById('editStoryModal').classList.add('hidden');
        this.editingStoryId = null;
    }

    deleteStory(storyId) {
        if (confirm('Вы уверены, что хотите удалить эту историю?')) {
            this.socket.emit('delete_story', {
                story_id: storyId,
                room_id: this.roomData.room_id
            });
        }
    }

    handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.storyId);
        e.target.style.opacity = '0.5';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        const draggedStoryId = e.dataTransfer.getData('text/plain');
        const targetElement = e.target.closest('[data-story-id]');
        
        if (!targetElement) return;
        
        const targetStoryId = targetElement.dataset.storyId;
        
        if (draggedStoryId !== targetStoryId) {
            this.reorderStories(draggedStoryId, targetStoryId);
        }
        
        document.querySelectorAll('[data-story-id]').forEach(el => {
            el.style.opacity = '1';
        });
    }

    reorderStories(draggedStoryId, targetStoryId) {
        const draggedIndex = this.stories.findIndex(s => s.id === draggedStoryId);
        const targetIndex = this.stories.findIndex(s => s.id === targetStoryId);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        const storyOrders = [];
        const newStories = [...this.stories];
        const [draggedStory] = newStories.splice(draggedIndex, 1);
        newStories.splice(targetIndex, 0, draggedStory);
        
        newStories.forEach((story, index) => {
            storyOrders.push({
                storyId: story.id,
                orderPosition: index + 1
            });
        });
        
        this.socket.emit('reorder_stories', {
            room_id: this.roomData.room_id,
            story_orders: storyOrders
        });
    }

    updateLocalStoryOrder(storyOrders) {
        const orderMap = {};
        storyOrders.forEach(order => {
            orderMap[order.storyId] = order.orderPosition;
        });
        
        this.stories.forEach(story => {
            if (orderMap[story.id] !== undefined) {
                story.order_position = orderMap[story.id];
            }
        });
        
        this.stories.sort((a, b) => (a.order_position || 0) - (b.order_position || 0));
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 left-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

let room;
document.addEventListener('DOMContentLoaded', () => {
    try {
        room = new PlanningPokerRoom();
        window.room = room;
        console.log('Room initialized successfully:', room);
    } catch (error) {
        console.error('Failed to initialize room:', error);
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!room) {
            try {
                room = new PlanningPokerRoom();
                window.room = room;
                console.log('Room initialized via fallback:', room);
            } catch (error) {
                console.error('Failed to initialize room via fallback:', error);
            }
        }
    });
} else {
    if (!room) {
        try {
            room = new PlanningPokerRoom();
            window.room = room;
            console.log('Room initialized immediately:', room);
        } catch (error) {
            console.error('Failed to initialize room immediately:', error);
        }
    }
}
